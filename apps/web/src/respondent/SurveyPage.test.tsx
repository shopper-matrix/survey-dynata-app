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
    await vi.waitFor(
      () => {
        expect(replace).toHaveBeenCalledWith('/end?rst=2');
      },
      { timeout: 3000 },
    );
  });
});

describe('SurveyPage flow (DSA-404)', () => {
  const choice = (code: string, text: string) => ({
    done: false,
    progress: 50,
    question: {
      code,
      type: 'single_choice',
      text,
      config: {
        options: [
          { id: '1', label: 'Ja' },
          { id: '2', label: 'Nein' },
        ],
      },
    },
  });

  it('validates, saves each answer, shows the next question and finishes', async () => {
    let answered = 0;
    const replace = vi.fn();
    vi.stubGlobal('location', { replace });
    const fetchStub = vi.fn((input: string, init?: RequestInit) => {
      const path = input.replace('/api/session/', '');
      if (path === 'questions') return Promise.resolve(Response.json(choice('Q1', 'Erste Frage')));
      if (path === 'answers') {
        answered += 1;
        const body = answered === 1 ? choice('Q2', 'Zweite Frage') : { done: true };
        return Promise.resolve(Response.json(body));
      }
      if (path === 'finish') {
        return Promise.resolve(
          Response.json({ done: true, outcome: 'complete', redirectUrl: '/end?rst=1' }),
        );
      }
      return Promise.resolve(
        Response.json({ error: `unexpected ${path} ${String(init?.method)}` }, { status: 500 }),
      );
    });
    vi.stubGlobal('fetch', fetchStub);

    render(<SurveyPage />);
    expect(await screen.findByRole('heading', { name: 'Erste Frage' })).toBeDefined();
    expect(screen.getByRole('progressbar', { name: 'Survey progress' })).toBeDefined();

    // Next without an answer: friendly message, nothing sent.
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toBe('Please choose one answer.');
    expect(answered).toBe(0);

    await userEvent.click(screen.getByText('Ja'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'Zweite Frage' })).toBeDefined();
    const [, init] = fetchStub.mock.calls.find(([url]) => url.endsWith('answers')) ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      questionCode: 'Q1',
      value: { optionId: '1' },
    });

    await userEvent.click(screen.getByText('Nein'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await vi.waitFor(
      () => {
        expect(replace).toHaveBeenCalledWith('/end?rst=1');
      },
      { timeout: 3000 },
    );
  });
});
