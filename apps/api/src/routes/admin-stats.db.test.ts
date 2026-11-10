// Integration test: live fieldwork stats for the admin dashboard.
import { randomUUID } from 'node:crypto';
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
let surveyId = '';
let adminId = '';
let cookie = '';
let app: FastifyInstance;

const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  const survey = await db.survey.create({
    data: {
      title: 'Stats',
      targetCompletes: 10,
      quotaCells: {
        create: {
          name: 'Frauen',
          target: 5,
          currentCount: 2,
          conditions: { question: 'Q1', op: 'equals', value: 'f' },
        },
      },
    },
  });
  surveyId = survey.id;
  const people = [
    ['P-1', 'complete', '2026-11-02T10:00:00Z', '2026-11-02T10:10:00Z', false],
    ['P-2', 'complete', '2026-11-04T10:00:00Z', '2026-11-04T10:20:00Z', false],
    ['P-3', 'screenout', '2026-11-04T11:00:00Z', '2026-11-04T11:02:00Z', false],
    ['P-4', 'quality', '2026-11-04T12:00:00Z', '2026-11-04T12:01:00Z', false],
    ['P-5', 'started', '2026-11-05T09:00:00Z', null, false],
    ['TEST-1', 'complete', '2026-11-05T10:00:00Z', '2026-11-05T10:05:00Z', true],
  ] as const;
  for (const [panelRespondentId, status, started, ended, isTest] of people) {
    await db.respondent.create({
      data: {
        surveyId,
        panelRespondentId,
        status,
        isTest,
        startedAt: at(started),
        ...(ended ? { endedAt: at(ended) } : {}),
        ...(status === 'quality' ? { qualityFlags: ['speeder'] } : {}),
      },
    });
  }
  app = await buildApp({
    db,
    env: { APP_BASE_URL: 'http://localhost:5173', SESSION_SECRET: 'x'.repeat(32) },
    provider: {} as SampleProvider,
  });
  const admin = await db.adminUser.create({
    data: { email: `viewer-stats-${randomUUID()}@example.test`, role: 'viewer', passwordHash: 'x' },
  });
  adminId = admin.id;
  cookie = `${ADMIN_COOKIE}=${await createAdminSession(db, admin.id)}`;
});

afterAll(async () => {
  await db.survey.deleteMany({ where: { id: surveyId } });
  await db.adminUser.deleteMany({ where: { id: adminId } });
  await app.close();
  await db.$disconnect();
});

describe('fieldwork stats (DSA-605)', () => {
  it('reports counters, completes per day, quotas and recent respondents without test data', async () => {
    const response = await app.inject({
      url: `/api/admin/surveys/${surveyId}/stats`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const stats = response.json<{
      counters: unknown;
      completesPerDay: unknown;
      quotas: unknown;
      recent: { panelRespondentId: string; qualityFlags: string[] }[];
    }>();
    expect(stats.counters).toEqual({
      starts: 5,
      completes: 2,
      screenouts: 1,
      overquotas: 0,
      qualityTerms: 1,
      incidenceRate: 2 / 3,
      medianLoiMinutes: 15,
    });
    expect(stats.completesPerDay).toEqual([
      { day: '2026-11-02', completes: 1 },
      { day: '2026-11-03', completes: 0 },
      { day: '2026-11-04', completes: 1 },
    ]);
    expect(stats.quotas).toEqual([{ name: 'Frauen', kind: 'cap', target: 5, currentCount: 2 }]);
    expect(stats.recent.map((r) => r.panelRespondentId)).toEqual([
      'P-5',
      'P-4',
      'P-3',
      'P-2',
      'P-1',
    ]);
    expect(stats.recent[1]?.qualityFlags).toEqual(['speeder']);
  });

  it('needs an admin session and an existing survey', async () => {
    expect((await app.inject({ url: `/api/admin/surveys/${surveyId}/stats` })).statusCode).toBe(
      401,
    );
    const missing = await app.inject({
      url: `/api/admin/surveys/${randomUUID()}/stats`,
      headers: { cookie },
    });
    expect(missing.statusCode).toBe(404);
  });
});
