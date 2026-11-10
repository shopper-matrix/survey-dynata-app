import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { details, renderBuilder, stubAdminApi } from './test-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('survey builder (DSA-603)', () => {
  it('lists blocks and questions and saves an edited question', async () => {
    const calls = stubAdminApi({
      'GET /me': () => ({ body: { email: 'e@x.test', role: 'editor' } }),
      'GET /surveys/s1': () => ({ body: details() }),
      'PUT /surveys/s1/questions/Q1': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('button', { name: /Q1\s*Erste Frage/ }));

    const editor = screen.getByRole('region', { name: 'Edit Q1' });
    const text = within(editor).getByLabelText('Question text');
    await userEvent.clear(text);
    await userEvent.type(text, 'Geänderte Frage');
    // The phone preview shows the change with the respondent components.
    expect(within(editor).getByRole('heading', { name: 'Geänderte Frage' })).toBeDefined();

    await userEvent.click(within(editor).getByRole('button', { name: 'Save question' }));
    const saved = calls.find((c) => c.method === 'PUT');
    expect(saved?.body).toMatchObject({
      blockCode: 'A',
      question: { code: 'Q1', text: 'Geänderte Frage' },
    });
  });

  it('shows problems and blocks saving while the question is invalid', async () => {
    stubAdminApi({
      'GET /me': () => ({ body: { email: 'e@x.test', role: 'editor' } }),
      'GET /surveys/s1': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('button', { name: /Q1\s*Erste Frage/ }));
    const editor = screen.getByRole('region', { name: 'Edit Q1' });
    await userEvent.clear(within(editor).getByLabelText(/options/i));
    expect(within(editor).getByRole('list', { name: 'Problems' })).toBeDefined();
    expect(
      within(editor).getByRole('button', { name: 'Save question' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('reorders questions with the arrow buttons', async () => {
    const calls = stubAdminApi({
      'GET /me': () => ({ body: { email: 'e@x.test', role: 'editor' } }),
      'GET /surveys/s1': () => ({ body: details() }),
      'POST /surveys/s1/blocks/A/reorder': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Q2 up' }));
    expect(calls.find((c) => c.path.endsWith('/reorder'))?.body).toEqual({ codes: ['Q2', 'Q1'] });
  });

  it('asks before changing a screener of a live survey and retries with confirmation', async () => {
    const calls = stubAdminApi({
      'GET /me': () => ({ body: { email: 'e@x.test', role: 'editor' } }),
      'GET /surveys/s1': () => ({ body: details('live') }),
      'PUT /surveys/s1/questions/Q1': () => ({
        status: 409,
        body: { error: 'confirmation_required' },
      }),
      'PUT /surveys/s1/questions/Q1\\?confirm=true': () => ({ body: details('live') }),
    });
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    renderBuilder();
    await userEvent.click(await screen.findByRole('button', { name: /Q1\s*Erste Frage/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save question' }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.path.endsWith('?confirm=true'))).toBe(true);
    });
    expect(confirm).toHaveBeenCalled();
  });

  it('is read-only for viewers', async () => {
    stubAdminApi({
      'GET /me': () => ({ body: { email: 'v@x.test', role: 'viewer' } }),
      'GET /surveys/s1': () => ({ body: details() }),
    });
    renderBuilder();
    expect(await screen.findByRole('button', { name: /Q1\s*Erste Frage/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add question' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start testing' })).toBeNull();
  });
});
