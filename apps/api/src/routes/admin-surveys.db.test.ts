// Integration test: admin CRUD for surveys, blocks, questions, screening rules and quotas.
import { randomUUID } from 'node:crypto';
import type { AdminRole } from '@survey-dynata/shared/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE } from '../admin/auth.js';
import { createAdminSession } from '../admin/sessions.js';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import type { SampleProvider } from '../providers/sample-provider.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);
const run = randomUUID().slice(0, 8);
const cookies: Partial<Record<AdminRole, string>> = {};
const adminIds: string[] = [];
const surveyIds: string[] = [];
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    db,
    env: { APP_BASE_URL: 'http://localhost:5173', SESSION_SECRET: 'x'.repeat(32) },
    provider: {} as SampleProvider,
  });
  for (const role of ['owner', 'editor', 'viewer'] as const) {
    const admin = await db.adminUser.create({
      data: { email: `${role}-crud-${run}@example.test`, role, passwordHash: 'unused' },
    });
    adminIds.push(admin.id);
    cookies[role] = `${ADMIN_COOKIE}=${await createAdminSession(db, admin.id)}`;
  }
});

afterAll(async () => {
  await db.answer.deleteMany({ where: { respondent: { surveyId: { in: surveyIds } } } });
  await db.survey.deleteMany({ where: { id: { in: surveyIds } } });
  await db.adminAuditLog.deleteMany({ where: { adminUserId: { in: adminIds } } });
  await db.adminUser.deleteMany({ where: { id: { in: adminIds } } });
  await app.close();
  await db.$disconnect();
});

interface Details {
  status: string;
  definition: {
    blocks: { code: string; questions: { code: string; screenOut?: unknown }[] }[];
    quotas: { name: string }[];
  };
}

const call = (
  role: AdminRole,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
) => {
  const headers = { cookie: cookies[role] ?? '' };
  return payload === undefined
    ? app.inject({ method, url, headers })
    : app.inject({ method, url, headers, payload });
};

const choice = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  type: 'single_choice',
  text: `${code}?`,
  config: {
    options: [
      { id: '1', label: 'Ja' },
      { id: '2', label: 'Nein' },
    ],
  },
  ...extra,
});

async function newSurvey(): Promise<string> {
  const response = await call('editor', 'POST', '/api/admin/surveys', {
    title: `CRUD ${run}`,
    targetCompletes: 100,
  });
  expect(response.statusCode).toBe(201);
  const { id } = response.json<{ id: string }>();
  surveyIds.push(id);
  return id;
}

describe('admin survey API', () => {
  it('creates a draft survey with a first block and lists it', async () => {
    const id = await newSurvey();
    const details = (await call('viewer', 'GET', `/api/admin/surveys/${id}`)).json<Details>();
    expect(details.status).toBe('draft');
    expect(details.definition.blocks.map((b) => b.code)).toEqual(['A']);
    const list = (await call('viewer', 'GET', '/api/admin/surveys')).json<{ id: string }[]>();
    expect(list.some((s) => s.id === id)).toBe(true);
  });

  it('lets only editors and owners change surveys', async () => {
    const id = await newSurvey();
    expect(
      (await call('viewer', 'PATCH', `/api/admin/surveys/${id}`, { title: 'X' })).statusCode,
    ).toBe(403);
    expect((await call('editor', 'DELETE', `/api/admin/surveys/${id}`)).statusCode).toBe(403);
    expect(
      (await call('editor', 'PATCH', `/api/admin/surveys/${id}`, { title: 'Renamed' })).statusCode,
    ).toBe(200);
  });

  it('adds, updates, reorders and deletes questions with a screening rule', async () => {
    const id = await newSurvey();
    const base = `/api/admin/surveys/${id}`;
    await call('editor', 'POST', `${base}/questions`, { blockCode: 'A', question: choice('Q1') });
    const added = await call('editor', 'POST', `${base}/questions`, {
      blockCode: 'A',
      question: choice('Q2', {
        isScreener: true,
        screenOut: { question: 'Q2', op: 'equals', value: '2' },
      }),
    });
    expect(added.statusCode).toBe(200);

    const reordered = await call('editor', 'POST', `${base}/blocks/A/reorder`, {
      codes: ['Q2', 'Q1'],
    });
    const questions = reordered.json<Details>().definition.blocks[0]?.questions ?? [];
    expect(questions.map((q) => q.code)).toEqual(['Q2', 'Q1']);
    expect(questions[0]?.screenOut).toEqual({ question: 'Q2', op: 'equals', value: '2' });

    const updated = await call('editor', 'PUT', `${base}/questions/Q1`, {
      blockCode: 'A',
      question: choice('Q1', { text: 'Changed?' }),
    });
    expect(updated.statusCode).toBe(200);

    expect((await call('editor', 'DELETE', `${base}/questions/Q1`)).statusCode).toBe(200);
    const remaining = (await call('viewer', 'GET', base)).json<Details>().definition.blocks[0]
      ?.questions;
    expect(remaining?.map((q) => q.code)).toEqual(['Q2']);
  });

  it('validates inputs with the shared schemas', async () => {
    const id = await newSurvey();
    const badConfig = await call('editor', 'POST', `/api/admin/surveys/${id}/questions`, {
      blockCode: 'A',
      question: { ...choice('Q1'), config: { options: [] } },
    });
    expect(badConfig.statusCode).toBe(400);
    const badQuota = await call('editor', 'POST', `/api/admin/surveys/${id}/quotas`, {
      name: 'X',
      target: 0,
      conditions: { question: 'Q1', op: 'equals', value: '1' },
    });
    expect(badQuota.statusCode).toBe(400);
  });

  it('rolls back a change that would break a reference', async () => {
    const id = await newSurvey();
    const base = `/api/admin/surveys/${id}`;
    await call('editor', 'POST', `${base}/questions`, { blockCode: 'A', question: choice('Q1') });
    await call('editor', 'POST', `${base}/questions`, {
      blockCode: 'A',
      question: choice('Q2', { displayLogic: { question: 'Q1', op: 'equals', value: '1' } }),
    });
    const broken = await call('editor', 'DELETE', `${base}/questions/Q1`);
    expect(broken.statusCode).toBe(400);
    expect(broken.json()).toMatchObject({ error: 'invalid_survey' });
    const blocks = (await call('viewer', 'GET', base)).json<Details>().definition.blocks;
    expect(blocks[0]?.questions.map((q) => q.code)).toEqual(['Q1', 'Q2']);
  });

  it('asks for confirmation before screeners or quotas of a live survey change', async () => {
    const id = await newSurvey();
    const base = `/api/admin/surveys/${id}`;
    await call('editor', 'POST', `${base}/questions`, { blockCode: 'A', question: choice('Q1') });
    await call('editor', 'PATCH', base, { status: 'test' });
    expect((await call('editor', 'PATCH', base, { status: 'live' })).json<Details>().status).toBe(
      'live',
    );

    const quota = {
      name: 'Ja',
      target: 10,
      conditions: { question: 'Q1', op: 'equals', value: '1' },
    };
    const unconfirmed = await call('editor', 'POST', `${base}/quotas`, quota);
    expect(unconfirmed.statusCode).toBe(409);
    expect(unconfirmed.json()).toMatchObject({ error: 'confirmation_required' });
    const confirmed = await call('editor', 'POST', `${base}/quotas?confirm=true`, quota);
    expect(confirmed.json<Details>().definition.quotas.map((q) => q.name)).toEqual(['Ja']);

    // Non-screening changes need no confirmation.
    expect((await call('editor', 'PATCH', base, { title: 'Still live' })).statusCode).toBe(200);
  });

  it('only allows the status flow draft → test → live → closed', async () => {
    const id = await newSurvey();
    const response = await call('editor', 'PATCH', `/api/admin/surveys/${id}`, { status: 'live' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'status_change_not_allowed' });
  });

  it('refuses to delete surveys or questions with fieldwork data', async () => {
    const id = await newSurvey();
    const base = `/api/admin/surveys/${id}`;
    const added = await call('editor', 'POST', `${base}/questions`, {
      blockCode: 'A',
      question: choice('Q1'),
    });
    expect(added.statusCode).toBe(200);
    const question = await db.question.findFirstOrThrow({ where: { surveyId: id, code: 'Q1' } });
    const respondent = await db.respondent.create({
      data: { surveyId: id, panelRespondentId: 'R1' },
    });
    await db.answer.create({
      data: { respondentId: respondent.id, questionId: question.id, value: { optionId: '1' } },
    });

    expect((await call('editor', 'DELETE', `${base}/questions/Q1`)).statusCode).toBe(409);
    expect((await call('owner', 'DELETE', base)).statusCode).toBe(409);
  });

  it('audits every change', async () => {
    const id = await newSurvey();
    await call('editor', 'PATCH', `/api/admin/surveys/${id}`, { title: 'Audited' });
    const actions = await db.adminAuditLog.findMany({
      where: { target: id },
      select: { action: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual(['survey_created', 'survey_updated']);
  });
});
