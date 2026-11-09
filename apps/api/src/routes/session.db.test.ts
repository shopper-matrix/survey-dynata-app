// Integration test: the respondent session API against a real database.
import { randomUUID } from 'node:crypto';
import { surveyDefinitionSchema, type SurveyDefinitionInput } from '@survey-dynata/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { SESSION_COOKIE } from '../http/session.js';
import { createDynataClient } from '../dynata/client.js';
import { DYNATA_API_URL, type DynataConfig } from '../dynata/config.js';
import { createDynataProvider } from '../dynata/provider.js';
import { hasValidSignature } from '../dynata/signature.js';
import { importSurvey } from '../survey-import/import-survey.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);
const surveyId = randomUUID();
let app: FastifyInstance;

const BASE = 'http://localhost:5173';
const dynata: DynataConfig = {
  mode: 'mock',
  keyId: 'k',
  secret: 'mock-secret',
  apiUrl: DYNATA_API_URL,
};

const options = (...ids: string[]) => ids.map((id) => ({ id, label: `Option ${id}` }));

const definition: SurveyDefinitionInput = {
  survey: { id: surveyId, title: 'Session test', language: 'de', targetCompletes: 10 },
  assignments: [{ name: 'cell', values: ['A', 'B'] }],
  blocks: [
    {
      code: 'A',
      title: 'Screening',
      questions: [
        {
          code: 'S1',
          type: 'multi_choice',
          text: 'Which bars?',
          isScreener: true,
          config: {
            options: [
              ...options('1', '2', '3', 'x'),
              { id: 'none', label: 'None', exclusive: true },
            ],
          },
          screenOut: { question: 'S1', op: 'includes_any', value: ['x'] },
        },
        {
          code: 'P1',
          type: 'single_choice',
          text: 'Which most often?',
          config: { options: options('1', '2', '3'), pipeFrom: { question: 'S1' } },
        },
      ],
    },
    {
      code: 'B',
      title: 'Main',
      questions: [
        { code: 'I1', type: 'info', text: 'Next part', config: { body: 'Hello' } },
        {
          code: 'T1',
          type: 'timed_exposure',
          text: 'What was that?',
          config: {
            exposureMs: 3000,
            assignment: 'cell',
            stimuli: [
              { id: 'A', label: 'Pack A' },
              { id: 'B', label: 'Pack B' },
            ],
            options: options('bar', 'cereal'),
          },
        },
        { code: 'O1', type: 'open_text', text: 'Why?', config: { maxLength: 100 } },
      ],
    },
  ],
};

beforeAll(async () => {
  await db.$transaction((tx) => importSurvey(tx, surveyDefinitionSchema.parse(definition)));
  app = await buildApp({
    db,
    env: { APP_BASE_URL: BASE, SESSION_SECRET: 'x'.repeat(32) },
    provider: createDynataProvider({
      client: createDynataClient(dynata, { appBaseUrl: BASE }),
      config: dynata,
      appBaseUrl: BASE,
    }),
  });
});

afterAll(async () => {
  await db.answer.deleteMany({ where: { respondent: { surveyId } } });
  await db.survey.deleteMany({ where: { id: surveyId } });
  await app.close();
  await db.$disconnect();
});

interface ScreenBody {
  done: boolean;
  progress?: number;
  question?: { code: string; config: Record<string, unknown> };
}
const screen = (response: { json: () => unknown }) => response.json() as ScreenBody;
const ids = (items: unknown) =>
  (items as { id: string }[] | undefined)?.map((item) => item.id) ?? [];

async function newSession() {
  const respondent = await db.respondent.create({
    data: { surveyId, panelRespondentId: `P-${randomUUID()}` },
  });
  const cookie = `${SESSION_COOKIE}=${app.signCookie(respondent.id)}`;
  return {
    respondent,
    get: () => app.inject({ method: 'GET', url: '/api/session/questions', headers: { cookie } }),
    answer: (questionCode: string, value: unknown, responseTimeMs?: number) =>
      app.inject({
        method: 'POST',
        url: '/api/session/answers',
        headers: { cookie },
        payload: {
          questionCode,
          value,
          ...(responseTimeMs === undefined ? {} : { responseTimeMs }),
        },
      }),
  };
}

describe('respondent session API', () => {
  it('rejects requests without a valid session', async () => {
    const none = await app.inject('/api/session/questions');
    expect(none.statusCode).toBe(401);
    const forged = await app.inject({
      url: '/api/session/questions',
      headers: { cookie: `${SESSION_COOKIE}=${randomUUID()}.forged` },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('walks through the survey: piping, info screen, split cell, done', async () => {
    const session = await newSession();

    const first = screen(await session.get());
    expect(first).toMatchObject({ done: false, progress: 0, question: { code: 'S1' } });
    expect(first.question?.config).not.toHaveProperty('notes');

    const piped = screen(await session.answer('S1', { optionIds: ['1', '3'] }));
    expect(piped.question?.code).toBe('P1');
    expect(ids(piped.question?.config.options)).toEqual(['1', '3']);

    // Option 2 was not shown, so it is not a valid answer.
    expect((await session.answer('P1', { optionId: '2' })).statusCode).toBe(400);
    expect(screen(await session.answer('P1', { optionId: '3' })).question?.code).toBe('I1');

    const timed = screen(await session.answer('I1', { seen: true }));
    expect(timed.question?.code).toBe('T1');
    const [shown] = ids(timed.question?.config.stimuli);
    const stored = await db.respondent.findUniqueOrThrow({ where: { id: session.respondent.id } });
    expect((stored.assignments as Record<string, unknown>).cell).toBe(shown);

    await session.answer('T1', { stimulusId: shown, optionId: 'bar' }, 1234);
    expect(screen(await session.answer('O1', { text: 'Because.' }))).toEqual({ done: true });

    const t1 = await db.answer.findFirstOrThrow({
      where: { respondentId: session.respondent.id, question: { code: 'T1' } },
    });
    expect(t1.responseTimeMs).toBe(1234);
  });

  it('returns the same screen on reload', async () => {
    const session = await newSession();
    await session.answer('S1', { optionIds: ['2', '3'] });
    const a = screen(await session.get());
    const b = screen(await session.get());
    expect(b).toEqual(a);
  });

  it('refuses answers to questions not reached yet and changes to a screener', async () => {
    const session = await newSession();
    const ahead = await session.answer('O1', { text: 'Skipping ahead' });
    expect(ahead.statusCode).toBe(409);
    expect(ahead.json()).toEqual({ error: 'not_current' });

    await session.answer('S1', { optionIds: ['1'] });
    const changed = await session.answer('S1', { optionIds: ['2'] });
    expect(changed.statusCode).toBe(409);
    expect(changed.json()).toEqual({ error: 'screener_locked' });
  });

  it('lets earlier non-screener answers be changed', async () => {
    const session = await newSession();
    await session.answer('S1', { optionIds: ['1', '2'] });
    await session.answer('P1', { optionId: '1' });
    const changed = await session.answer('P1', { optionId: '2' });
    expect(changed.statusCode).toBe(200);
    const p1 = await db.answer.findFirstOrThrow({
      where: { respondentId: session.respondent.id, question: { code: 'P1' } },
    });
    expect(p1.value).toEqual({ optionId: '2' });
  });

  it('validates the request and the answer', async () => {
    const session = await newSession();
    expect((await session.answer('S1', { optionIds: ['1', 'none'] })).statusCode).toBe(400);
    expect((await session.answer('NOPE', { optionId: '1' })).statusCode).toBe(404);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/session/answers',
      headers: { cookie: `${SESSION_COOKIE}=${app.signCookie(session.respondent.id)}` },
      payload: { value: 1 },
    });
    expect(bad.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('stops finished respondents', async () => {
    const session = await newSession();
    await db.respondent.update({
      where: { id: session.respondent.id },
      data: { status: 'complete' },
    });
    const response = await session.answer('S1', { optionIds: ['1'] });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'finished' });
  });

  it('balances the split cell across respondents', async () => {
    const cells: string[] = [];
    for (let i = 0; i < 4; i++) {
      const session = await newSession();
      await session.answer('S1', { optionIds: ['none'] });
      await session.answer('I1', { seen: true });
      const stored = await db.respondent.findUniqueOrThrow({
        where: { id: session.respondent.id },
      });
      cells.push(String((stored.assignments as Record<string, unknown>).cell));
    }
    // Earlier tests assigned one respondent; four more keep the cells within one of each other.
    const total = await db.respondent.findMany({
      where: { surveyId },
      select: { assignments: true },
    });
    const count = (cell: string) =>
      total.filter((r) => (r.assignments as Record<string, unknown>).cell === cell).length;
    expect(Math.abs(count('A') - count('B'))).toBeLessThanOrEqual(1);
    expect(cells).toHaveLength(4);
  });
});

describe('screening (DSA-307)', () => {
  it('screens a respondent out right after a failing screener answer', async () => {
    const session = await newSession();
    const response = await session.answer('S1', { optionIds: ['1', 'x'] });
    expect(response.json()).toMatchObject({ done: true, outcome: 'screenout' });

    const stored = await db.respondent.findUniqueOrThrow({ where: { id: session.respondent.id } });
    expect(stored.status).toBe('screenout');
    expect(stored.endedAt).toBeInstanceOf(Date);
    expect(screen(await session.get())).toMatchObject({ done: true });
  });

  it('lets a respondent who passes the screener continue', async () => {
    const session = await newSession();
    const response = await session.answer('S1', { optionIds: ['1'] });
    expect(screen(response).question?.code).toBe('P1');
  });
});

describe('finishing a session (DSA-305)', () => {
  async function answerEverything(session: Awaited<ReturnType<typeof newSession>>) {
    await session.answer('S1', { optionIds: ['1'] });
    // Piping leaves a single option on screen.
    expect((await session.answer('P1', { optionId: '1' })).statusCode).toBe(200);
    const timed = screen(await session.answer('I1', { seen: true }));
    const [shown] = ids(timed.question?.config.stimuli);
    await session.answer('T1', { stimulusId: shown, optionId: 'bar' });
    await session.answer('O1', { text: 'Fine.' });
  }
  const finish = (session: Awaited<ReturnType<typeof newSession>>) =>
    app.inject({
      method: 'POST',
      url: '/api/session/finish',
      headers: { cookie: `${SESSION_COOKIE}=${app.signCookie(session.respondent.id)}` },
    });

  it('refuses to finish before every question is answered', async () => {
    const session = await newSession();
    const response = await finish(session);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'not_finished' });
  });

  it('completes, logs the redirect and returns a signed end link', async () => {
    const session = await newSession();
    await answerEverything(session);
    const body = finish(session).then((r) => r.json<{ outcome: string; redirectUrl: string }>());
    const { outcome, redirectUrl } = await body;
    expect(outcome).toBe('complete');
    expect(redirectUrl).toContain(
      `/mock-dynata/end?rst=1&psid=${session.respondent.panelRespondentId}`,
    );
    expect(hasValidSignature(redirectUrl, dynata.secret)).toBe(true);

    const stored = await db.respondent.findUniqueOrThrow({ where: { id: session.respondent.id } });
    expect(stored.status).toBe('complete');
    const logs = await db.redirectLog.findMany({ where: { respondentId: session.respondent.id } });
    expect(logs).toEqual([expect.objectContaining({ outcome: 'complete', url: redirectUrl })]);
  });

  it('is idempotent: refresh and double clicks return the same link, logged once', async () => {
    const session = await newSession();
    await answerEverything(session);
    const results = await Promise.all([finish(session), finish(session), finish(session)]);
    const urls = results.map((r) => r.json<{ redirectUrl: string }>().redirectUrl);
    expect(new Set(urls).size).toBe(1);
    expect(await db.redirectLog.count({ where: { respondentId: session.respondent.id } })).toBe(1);
    expect(screen(await session.get())).toMatchObject({ done: true, redirectUrl: urls[0] });
  });

  it('sends screened-out respondents to the screen-out link and logs it', async () => {
    const session = await newSession();
    const body = (await session.answer('S1', { optionIds: ['x'] })).json<{
      outcome: string;
      redirectUrl: string;
    }>();
    expect(body.outcome).toBe('screenout');
    expect(body.redirectUrl).toContain('/mock-dynata/end?rst=2&psid=');
    expect(await db.redirectLog.count({ where: { respondentId: session.respondent.id } })).toBe(1);
  });

  it('shows the outcome on the local mock end page', async () => {
    const session = await newSession();
    await answerEverything(session);
    const { redirectUrl } = (await finish(session)).json<{ redirectUrl: string }>();
    const page = await app.inject(redirectUrl.replace(BASE, ''));
    expect(page.body).toContain('Mock Dynata: Complete');
    expect(page.body).toContain('Signature: valid');
  });
});
