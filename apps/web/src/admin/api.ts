import type { SurveyDefinitionInput } from '@survey-dynata/shared';

// Client for the admin API (/api/admin). The session cookie is set by the login endpoint.

export type Role = 'owner' | 'editor' | 'viewer';
export type SurveyStatus = 'draft' | 'test' | 'live' | 'closed';

export interface Me {
  email: string;
  role: Role;
}

export interface SurveySummary {
  id: string;
  title: string;
  status: SurveyStatus;
  pausedAt: string | null;
  targetCompletes: number;
  completes: number;
  updatedAt: string;
}

export interface SurveyDetails {
  status: SurveyStatus;
  pausedAt: string | null;
  updatedAt: string;
  respondents: number;
  /** Link the sample provider sends respondents to. */
  entryUrl: string;
  /** Current count per quota cell name. */
  quotaCounts: Record<string, number>;
  definition: SurveyDefinitionInput;
}

export type QuotaInput = NonNullable<SurveyDefinitionInput['quotas']>[number];

export interface DynataSettings {
  projectId: string | null;
  mode: 'mock' | 'live';
  keyConfigured: boolean;
}

export type QuestionInput = SurveyDefinitionInput['blocks'][number]['questions'][number];

export type RespondentStatus =
  'started' | 'complete' | 'screenout' | 'overquota' | 'quality' | 'abandoned';

export interface FieldworkStats {
  counters: {
    starts: number;
    completes: number;
    screenouts: number;
    overquotas: number;
    qualityTerms: number;
    incidenceRate: number | null;
    medianLoiMinutes: number | null;
  };
  completesPerDay: { day: string; completes: number }[];
  quotas: { name: string; kind: 'cap' | 'minimum'; target: number; currentCount: number }[];
  recent: {
    panelRespondentId: string;
    status: RespondentStatus;
    startedAt: string;
    endedAt: string | null;
    deviceType: string | null;
    qualityFlags: string[];
  }[];
  updatedAt: string;
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = 'AdminApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    details?: unknown;
  };
  if (!response.ok) {
    throw new AdminApiError(response.status, payload.error ?? 'request_failed', payload.details);
  }
  return payload as T;
}

const survey = (id: string) => `/surveys/${id}`;
const withConfirm = (path: string, confirm: boolean) => (confirm ? `${path}?confirm=true` : path);

export const adminApi = {
  me: () => request<Me>('GET', '/me'),
  login: (email: string, password: string) => request<Me>('POST', '/login', { email, password }),
  logout: () => request<{ ok: true }>('POST', '/logout', {}),

  surveys: () => request<SurveySummary[]>('GET', '/surveys'),
  createSurvey: (input: { title: string; targetCompletes: number; language: string }) =>
    request<SurveyDetails & { id: string }>('POST', '/surveys', input),
  survey: (id: string) => request<SurveyDetails>('GET', survey(id)),
  updateSurvey: (id: string, patch: Record<string, unknown>) =>
    request<SurveyDetails>('PATCH', survey(id), patch),
  pause: (id: string, paused: boolean) =>
    request<SurveyDetails>('POST', `${survey(id)}/${paused ? 'pause' : 'resume'}`, {}),

  addBlock: (id: string, block: { code: string; title: string }) =>
    request<SurveyDetails>('POST', `${survey(id)}/blocks`, { ...block, questions: [] }),
  deleteBlock: (id: string, code: string) =>
    request<SurveyDetails>('DELETE', `${survey(id)}/blocks/${encodeURIComponent(code)}`),
  reorderBlocks: (id: string, codes: string[]) =>
    request<SurveyDetails>('POST', `${survey(id)}/blocks/reorder`, { codes }),

  addQuestion: (id: string, blockCode: string, question: QuestionInput, confirm = false) =>
    request<SurveyDetails>('POST', withConfirm(`${survey(id)}/questions`, confirm), {
      blockCode,
      question,
    }),
  saveQuestion: (
    id: string,
    code: string,
    blockCode: string,
    question: QuestionInput,
    confirm = false,
  ) =>
    request<SurveyDetails>(
      'PUT',
      withConfirm(`${survey(id)}/questions/${encodeURIComponent(code)}`, confirm),
      { blockCode, question },
    ),
  deleteQuestion: (id: string, code: string, confirm = false) =>
    request<SurveyDetails>(
      'DELETE',
      withConfirm(`${survey(id)}/questions/${encodeURIComponent(code)}`, confirm),
    ),
  reorderQuestions: (id: string, blockCode: string, codes: string[]) =>
    request<SurveyDetails>(
      'POST',
      `${survey(id)}/blocks/${encodeURIComponent(blockCode)}/reorder`,
      { codes },
    ),

  addQuota: (id: string, quota: QuotaInput, confirm = false) =>
    request<SurveyDetails>('POST', withConfirm(`${survey(id)}/quotas`, confirm), quota),
  saveQuota: (id: string, name: string, quota: QuotaInput, confirm = false) =>
    request<SurveyDetails>(
      'PUT',
      withConfirm(`${survey(id)}/quotas/${encodeURIComponent(name)}`, confirm),
      quota,
    ),
  deleteQuota: (id: string, name: string, confirm = false) =>
    request<SurveyDetails>(
      'DELETE',
      withConfirm(`${survey(id)}/quotas/${encodeURIComponent(name)}`, confirm),
    ),

  stats: (id: string) => request<FieldworkStats>('GET', `${survey(id)}/stats`),
  testLinks: (id: string, count: number) =>
    request<{ links: string[] }>('POST', `${survey(id)}/test-links`, { count }),
  deleteTestData: (id: string) => request<{ deleted: number }>('DELETE', `${survey(id)}/test-data`),
  /** Download URL (the browser sends the session cookie). */
  exportUrl: (id: string, format: 'csv' | 'sav') =>
    `/api/admin${survey(id)}/export?format=${format}`,

  dynata: (id: string) => request<DynataSettings>('GET', `${survey(id)}/dynata`),
  saveDynata: (id: string, projectId: string) =>
    request<DynataSettings>('PUT', `${survey(id)}/dynata`, { projectId }),
};
