// Shared helpers for the survey builder tests: a stubbed admin API and the routed page.
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import AdminLayout from '../AdminLayout';
import SurveyBuilderPage from './SurveyBuilderPage';

const choice = (code: string, text: string) => ({
  code,
  type: 'single_choice',
  text,
  isScreener: false,
  isAttentionCheck: false,
  notes: [],
  translations: {},
  config: {
    options: [
      { id: '1', label: 'Ja' },
      { id: '2', label: 'Nein' },
    ],
    randomize: false,
  },
});

export const details = (status = 'draft') => ({
  status,
  pausedAt: null,
  updatedAt: '2026-11-09T10:00:00Z',
  respondents: 0,
  entryUrl: 'http://localhost:5173/s/s1',
  quotaCounts: { Frauen: 30 } as Record<string, number>,
  definition: {
    survey: { id: 's1', title: 'Riegelstudie', language: 'de', targetCompletes: 100 },
    assignments: [],
    quotas: [
      {
        name: 'Frauen',
        kind: 'cap',
        target: 60,
        conditions: { question: 'Q1', op: 'equals', value: '1' },
      },
    ],
    blocks: [
      {
        code: 'A',
        title: 'Screening',
        questions: [choice('Q1', 'Erste Frage'), choice('Q2', 'Zweite Frage')],
      },
    ],
  },
});

type Handler = (method: string, body: unknown) => { status?: number; body: unknown };

export function stubAdminApi(handlers: Record<string, Handler>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = input.replace('/api/admin', '');
      const body: unknown = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path, body });
      const key = Object.keys(handlers).find((pattern) =>
        new RegExp(`^${pattern}$`).test(`${method} ${path}`),
      );
      const result = key
        ? handlers[key]?.(method, body)
        : { status: 404, body: { error: 'not_found' } };
      return Promise.resolve(Response.json(result?.body, { status: result?.status ?? 200 }));
    }),
  );
  return calls;
}

export function renderBuilder() {
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [{ path: 'surveys/:id', element: <SurveyBuilderPage /> }],
      },
    ],
    { initialEntries: ['/admin/surveys/s1'] },
  );
  render(<RouterProvider router={router} />);
}
