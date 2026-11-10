import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { details, renderBuilder, stubAdminApi } from './test-helpers';

const editor = () => ({ body: { email: 'e@x.test', role: 'editor' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('survey settings (DSA-504)', () => {
  it('saves privacy notice, retention and quality actions, clearing empty fields', async () => {
    const calls = stubAdminApi({
      'GET /me': editor,
      'GET /surveys/s1': () => ({ body: details() }),
      'PATCH /surveys/s1': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    const form = screen.getByRole('form', { name: 'Survey settings' });

    await userEvent.type(
      within(form).getByLabelText('Privacy notice'),
      'Verantwortlich: Shoppermetrics GmbH',
    );
    await userEvent.type(within(form).getByLabelText('Data retention (days)'), '730');
    await userEvent.selectOptions(within(form).getByLabelText('Speeders'), 'terminate');
    await userEvent.click(within(form).getByRole('button', { name: 'Save settings' }));

    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({
      intro: null,
      privacyNotice: 'Verantwortlich: Shoppermetrics GmbH',
      retentionDays: 730,
      quality: {
        speeder: { action: 'terminate' },
        straightlining: { action: 'flag' },
        attentionCheck: { action: 'terminate' },
      },
    });
    expect(await within(form).findByText('Saved.')).toBeDefined();
  });

  it('is read-only for viewers', async () => {
    stubAdminApi({
      'GET /me': () => ({ body: { email: 'v@x.test', role: 'viewer' } }),
      'GET /surveys/s1': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    expect(screen.getByLabelText('Privacy notice').hasAttribute('disabled')).toBe(false);
    expect(screen.getByLabelText('Privacy notice').closest('fieldset')?.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save settings' })).toBeNull();
  });
});

describe('attention check answer (DSA-501)', () => {
  it('needs the expected option before an attention check can be saved', async () => {
    const calls = stubAdminApi({
      'GET /me': editor,
      'GET /surveys/s1': () => ({ body: details() }),
      'PUT /surveys/s1/questions/Q1': () => ({ body: details() }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('button', { name: /Q1\s*Erste Frage/ }));
    const editorRegion = screen.getByRole('region', { name: 'Edit Q1' });
    await userEvent.click(within(editorRegion).getByRole('checkbox', { name: 'Attention check' }));
    const save = within(editorRegion).getByRole('button', { name: 'Save question' });
    expect(save.hasAttribute('disabled')).toBe(true);

    await userEvent.type(
      within(editorRegion).getByLabelText('Expected option id(s), comma-separated'),
      '2',
    );
    await userEvent.click(save);
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      question: { code: 'Q1', isAttentionCheck: true, attentionAnswer: { expected: ['2'] } },
    });
  });
});
