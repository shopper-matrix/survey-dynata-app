import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { details, renderBuilder, stubAdminApi } from './test-helpers';

const editor = () => ({ body: { email: 'e@x.test', role: 'editor' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('quota editor (DSA-604)', () => {
  it('shows each cell with its progress and saves an edited target', async () => {
    const calls = stubAdminApi({
      'GET /me': editor,
      'GET /surveys/s1': () => ({ body: details() }),
      'PUT /surveys/s1/quotas/Frauen': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Quotas' }));
    expect(screen.getByText('30 / 60')).toBeDefined();
    expect(screen.getByRole('progressbar', { name: 'Frauen progress' })).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Frauen' }));
    const form = screen.getByRole('form', { name: 'Edit quota Frauen' });
    const target = within(form).getByLabelText('Target');
    await userEvent.clear(target);
    await userEvent.type(target, '80');
    await userEvent.click(within(form).getByRole('button', { name: 'Save quota' }));
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      name: 'Frauen',
      target: 80,
      conditions: { question: 'Q1', op: 'equals', value: '1' },
    });
  });

  it('blocks saving while the conditions are not valid', async () => {
    stubAdminApi({ 'GET /me': editor, 'GET /surveys/s1': () => ({ body: details() }) });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Quotas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add quota' }));
    const form = screen.getByRole('form', { name: 'New quota' });
    const conditions = within(form).getByLabelText('Conditions (JSON)');
    await userEvent.clear(conditions);
    await userEvent.type(conditions, 'not json');
    expect(within(form).getByRole('list', { name: 'Problems' })).toBeDefined();
    expect(within(form).getByRole('button', { name: 'Save quota' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('asks before deleting a quota of a live survey', async () => {
    const calls = stubAdminApi({
      'GET /me': editor,
      'GET /surveys/s1': () => ({ body: details('live') }),
      'DELETE /surveys/s1/quotas/Frauen': () => ({
        status: 409,
        body: { error: 'confirmation_required' },
      }),
      'DELETE /surveys/s1/quotas/Frauen\\?confirm=true': () => ({ body: details('live') }),
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Quotas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Frauen' }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.path.endsWith('?confirm=true'))).toBe(true);
    });
  });
});

describe('Dynata settings (DSA-604)', () => {
  it('shows the entry link, copies it and saves the project ID', async () => {
    const calls = stubAdminApi({
      'GET /me': editor,
      'GET /surveys/s1': () => ({ body: details() }),
      'GET /surveys/s1/dynata': () => ({
        body: { projectId: null, mode: 'mock', keyConfigured: false },
      }),
      'PUT /surveys/s1/dynata': (_method, body) => ({
        body: { ...(body as object), mode: 'mock', keyConfigured: false },
      }),
    });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Dynata' }));

    const entry = await screen.findByLabelText('Entry link for Dynata');
    expect((entry as HTMLInputElement).value).toBe('http://localhost:5173/s/s1');
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('http://localhost:5173/s/s1');

    await userEvent.type(screen.getByLabelText('Dynata project ID'), 'DYN-42');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ projectId: 'DYN-42' });
    expect(await screen.findByText('Saved.')).toBeDefined();
  });

  it('explains a project ID already used by another survey', async () => {
    stubAdminApi({
      'GET /me': editor,
      'GET /surveys/s1': () => ({ body: details() }),
      'GET /surveys/s1/dynata': () => ({
        body: { projectId: null, mode: 'mock', keyConfigured: false },
      }),
      'PUT /surveys/s1/dynata': () => ({ status: 409, body: { error: 'project_in_use' } }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Dynata' }));
    await userEvent.type(await screen.findByLabelText('Dynata project ID'), 'DYN-1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/already used by another survey/)).toBeDefined();
  });
});
