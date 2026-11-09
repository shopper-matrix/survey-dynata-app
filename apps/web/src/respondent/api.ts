// Client for the respondent session API. The server decides every step; the browser shows what
// it gets and follows the redirect at the end.

export interface Welcome {
  title: string;
  language: string;
  intro: string | null;
  estimatedMinutes: number | null;
  privacyNotice: string | null;
  privacyPolicyUrl: string | null;
  botCheckSiteKey: string | null;
}

export interface PresentedQuestion {
  code: string;
  type: string;
  text: string;
  config: Record<string, unknown>;
}

export type Screen =
  | { done: false; welcome: Welcome }
  | { done: false; question: PresentedQuestion; progress: number }
  | { done: true; outcome?: string; redirectUrl?: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

async function call(path: string, body?: unknown): Promise<Screen> {
  const response = await fetch(`/api/session/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? 'request_failed');
  return payload as Screen;
}

export const sessionApi = {
  current: () => call('questions'),
  start: (botCheckToken?: string) => call('start', botCheckToken ? { botCheckToken } : {}),
  decline: () => call('decline', {}),
  answer: (questionCode: string, value: unknown, responseTimeMs?: number) =>
    call('answers', {
      questionCode,
      value,
      ...(responseTimeMs === undefined ? {} : { responseTimeMs }),
    }),
  finish: () => call('finish', {}),
};
