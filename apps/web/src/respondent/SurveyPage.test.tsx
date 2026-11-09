import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyPage } from './SurveyPage';

const welcome = {
  done: false,
  welcome: {
    title: 'Riegelstudie',
    language: 'de',
    intro: 'Wir möchten wissen, wie Sie Riegel kaufen.',
    estimatedMinutes: 15,
    privacyNotice: 'Wir erheben keine Namen.',
    privacyPolicyUrl: 'https://example.com/privacy',
    botCheckSiteKey: null,
  },
};
const firstQuestion = {
  done: false,
  progress: 0,
  question: { code: 'A1', type: 'single_choice', text: 'Geschlecht', config: { options: [] } },
};

function stubApi(responses: Record<string, unknown>) {
  const fetchStub = vi.fn((input: string) => {
    const path = input.replace('/api/session/', '');
    return Promise.resolve(Response.json(responses[path] ?? { error: 'not_stubbed' }));
  });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SurveyPage welcome (DSA-402)', () => {
  it('shows the introduction, length and privacy notice with Start as the main action', async () => {
    stubApi({ questions: welcome });
    render(<SurveyPage />);
    expect(await screen.findByRole('heading', { name: 'Riegelstudie' })).toBeDefined();
    expect(screen.getByText('About 15 minutes')).toBeDefined();
    expect(screen.getByText('Wir erheben keine Namen.')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Read the full privacy policy' }).getAttribute('href'),
    ).toBe('https://example.com/privacy');
  });

  it('starts the survey and shows the first question', async () => {
    const fetchStub = stubApi({ questions: welcome, start: firstQuestion });
    render(<SurveyPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('heading', { name: 'Geschlecht' })).toBeDefined();
    expect(fetchStub).toHaveBeenCalledWith(
      '/api/session/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('follows the screen-out link when the respondent declines', async () => {
    stubApi({
      questions: welcome,
      decline: { done: true, outcome: 'screenout', redirectUrl: '/end?rst=2' },
    });
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });
    render(<SurveyPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'No thanks' }));
    await vi.waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/end?rst=2');
    });
  });
});
