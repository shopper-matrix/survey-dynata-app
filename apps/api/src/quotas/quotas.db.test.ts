// Integration test: quota enforcement against a real database, including concurrent completes.
import { randomUUID } from 'node:crypto';
import { surveyDefinitionSchema } from '@survey-dynata/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { createDynataClient } from '../dynata/client.js';
import { DYNATA_API_URL, DYNATA_END_URL, type DynataConfig } from '../dynata/config.js';
import { createDynataProvider } from '../dynata/provider.js';
import { loadEnv } from '../env.js';
import { SESSION_COOKIE } from '../http/session.js';
import { importSurvey } from '../survey-import/import-survey.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const BASE = 'http://localhost:5173';
const db = createDb(loadEnv().DATABASE_URL);
const surveyId = randomUUID();
const dynata: DynataConfig = {
  mode: 'mock',
  keyId: 'k',
  secret: 's',
  apiUrl: DYNATA_API_URL,
  security: 'start-end',
  endUrl: DYNATA_END_URL,
  qualityFlag: '2',
};
let app: FastifyInstance;
let questionId: string;

beforeAll(async () => {
  const definition = surveyDefinitionSchema.parse({
    survey: { id: surveyId, title: 'Quota test', language: 'en', targetCompletes: 10 },
    blocks: [
      {
        code: 'A',
        title: 'A',
        questions: [
          {
            code: 'G',
            type: 'single_choice',
            text: 'Gender?',
            config: {
              options: [
                { id: 'w', label: 'Woman' },
                { id: 'm', label: 'Man' },
              ],
            },
          },
        ],
      },
    ],
    quotas: [
      { name: 'Women', target: 1, conditions: { question: 'G', op: 'equals', value: 'w' } },
      {
        name: 'Women (minimum)',
        kind: 'minimum',
        target: 500,
        conditions: { question: 'G', op: 'equals', value: 'w' },
      },
    ],
  });
  const result = await db.$transaction((tx) => importSurvey(tx, definition));
  questionId = result.questionIds.get('G') ?? '';
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

const cookieFor = (respondentId: string) => `${SESSION_COOKIE}=${app.signCookie(respondentId)}`;

const quota = async (name: string) =>
  (await db.quotaCell.findUniqueOrThrow({ where: { surveyId_name: { surveyId, name } } }))
    .currentCount;

describe('quota engine', () => {
  it('lets exactly one of 100 simultaneous completes into a cell with one slot left', async () => {
    const respondents = await db.respondent.createManyAndReturn({
      data: Array.from({ length: 100 }, (_, i) => ({
        surveyId,
        panelRespondentId: `RACE-${String(i)}`,
        consentedAt: new Date(),
      })),
    });
    await db.answer.createMany({
      data: respondents.map((r) => ({ respondentId: r.id, questionId, value: { optionId: 'w' } })),
    });

    const responses = await Promise.all(
      respondents.map((r) =>
        app.inject({
          method: 'POST',
          url: '/api/session/finish',
          headers: { cookie: cookieFor(r.id) },
        }),
      ),
    );
    const outcomes = responses.map((r) => r.json<{ outcome: string }>().outcome);
    expect(outcomes.filter((o) => o === 'complete')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'overquota')).toHaveLength(99);
    expect(await quota('Women')).toBe(1);
    // Minimum cells count completes too, but never close.
    expect(await quota('Women (minimum)')).toBe(1);
    expect(
      await db.redirectLog.count({ where: { respondent: { surveyId }, outcome: 'overquota' } }),
    ).toBe(99);
  }, 60_000);

  it('ends a respondent as over-quota while answering once their cell is full', async () => {
    const respondent = await db.respondent.create({
      data: { surveyId, panelRespondentId: `LATE-${randomUUID()}`, consentedAt: new Date() },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/session/answers',
      headers: { cookie: cookieFor(respondent.id) },
      payload: { questionCode: 'G', value: { optionId: 'w' } },
    });
    expect(response.json()).toMatchObject({ done: true, outcome: 'overquota' });
    expect(response.json<{ redirectUrl: string }>().redirectUrl).toContain('rst=3');
  });

  it('lets respondents outside the full cell complete', async () => {
    const respondent = await db.respondent.create({
      data: { surveyId, panelRespondentId: `MAN-${randomUUID()}`, consentedAt: new Date() },
    });
    const cookie = cookieFor(respondent.id);
    const answered = await app.inject({
      method: 'POST',
      url: '/api/session/answers',
      headers: { cookie },
      payload: { questionCode: 'G', value: { optionId: 'm' } },
    });
    expect(answered.json()).toEqual({ done: true });
    const finished = await app.inject({
      method: 'POST',
      url: '/api/session/finish',
      headers: { cookie },
    });
    expect(finished.json()).toMatchObject({ outcome: 'complete' });
    expect(await quota('Women')).toBe(1);
  });
});
