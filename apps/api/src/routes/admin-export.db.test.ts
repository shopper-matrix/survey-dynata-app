// Integration test: exporting fieldwork data as CSV and SPSS with filters.
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { surveyDefinitionSchema } from '@survey-dynata/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE } from '../admin/auth.js';
import { createAdminSession } from '../admin/sessions.js';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import type { SampleProvider } from '../providers/sample-provider.js';
import { importSurvey } from '../survey-import/import-survey.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const { SavBufferReader } = createRequire(import.meta.url)('sav-reader') as {
  SavBufferReader: new (buffer: Buffer) => {
    open(): Promise<void>;
    meta: { header: { n_cases: number } };
  };
};

const db = createDb(loadEnv().DATABASE_URL);
const surveyId = randomUUID();
const adminIds: string[] = [];
const cookies: Record<string, string> = {};
let app: FastifyInstance;

beforeAll(async () => {
  const definition = surveyDefinitionSchema.parse({
    survey: { id: surveyId, title: 'Export Test – Grüße', language: 'de', targetCompletes: 5 },
    blocks: [
      {
        code: 'A',
        title: 'A',
        questions: [
          {
            code: 'Q1',
            type: 'single_choice',
            text: 'Frage 1',
            config: {
              options: [
                { id: 'a', label: 'Ja' },
                { id: 'b', label: 'Nein' },
              ],
            },
          },
        ],
      },
    ],
  });
  const { questionIds } = await db.$transaction((tx) => importSurvey(tx, definition));
  const people = [
    {
      panelRespondentId: 'P-1',
      status: 'complete' as const,
      isTest: false,
      startedAt: new Date('2026-11-02T10:00:00Z'),
    },
    {
      panelRespondentId: 'P-2',
      status: 'screenout' as const,
      isTest: false,
      startedAt: new Date('2026-11-05T10:00:00Z'),
    },
    {
      panelRespondentId: 'TEST-1',
      status: 'complete' as const,
      isTest: true,
      startedAt: new Date('2026-11-05T11:00:00Z'),
    },
  ];
  for (const person of people) {
    const respondent = await db.respondent.create({ data: { surveyId, ...person } });
    await db.answer.create({
      data: {
        respondentId: respondent.id,
        questionId: questionIds.get('Q1') ?? '',
        value: { optionId: 'a' },
      },
    });
  }
  app = await buildApp({
    db,
    env: { APP_BASE_URL: 'http://localhost:5173', SESSION_SECRET: 'x'.repeat(32) },
    provider: {} as SampleProvider,
  });
  for (const role of ['editor', 'viewer'] as const) {
    const admin = await db.adminUser.create({
      data: { email: `${role}-export-${randomUUID()}@example.test`, role, passwordHash: 'unused' },
    });
    adminIds.push(admin.id);
    cookies[role] = `${ADMIN_COOKIE}=${await createAdminSession(db, admin.id)}`;
  }
});

afterAll(async () => {
  await db.answer.deleteMany({ where: { respondent: { surveyId } } });
  await db.survey.deleteMany({ where: { id: surveyId } });
  await db.adminAuditLog.deleteMany({ where: { adminUserId: { in: adminIds } } });
  await db.adminUser.deleteMany({ where: { id: { in: adminIds } } });
  await app.close();
  await db.$disconnect();
});

const exportAs = (query: string, role = 'editor') =>
  app.inject({
    url: `/api/admin/surveys/${surveyId}/export?${query}`,
    headers: { cookie: cookies[role] ?? '' },
  });
const csvLines = (body: string) => body.trim().split('\r\n').slice(1);

describe('data export', () => {
  it('exports CSV without test data by default', async () => {
    const response = await exportAs('format=csv');
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="Export-Test-Gruesse.csv"',
    );
    expect(csvLines(response.body)).toHaveLength(2);
  });

  it('filters by status, date range and test data', async () => {
    expect(csvLines((await exportAs('status=complete')).body)).toHaveLength(1);
    expect(csvLines((await exportAs('from=2026-11-04')).body)).toHaveLength(1);
    expect(csvLines((await exportAs('to=2026-11-04')).body)).toHaveLength(1);
    expect(csvLines((await exportAs('includeTest=true')).body)).toHaveLength(3);
  });

  it('writes value labels when asked', async () => {
    const lines = csvLines((await exportAs('labels=true&status=complete')).body);
    expect(lines[0]).toContain(',Ja');
  });

  it('exports an SPSS file', async () => {
    const response = await exportAs('format=sav');
    expect(response.headers['content-type']).toContain('application/x-spss-sav');
    const sav = new SavBufferReader(response.rawPayload);
    await sav.open();
    expect(sav.meta.header.n_cases).toBe(2);
  });

  it('is limited to editors and owners, and audited', async () => {
    expect((await exportAs('format=csv', 'viewer')).statusCode).toBe(403);
    expect(
      await db.adminAuditLog.count({ where: { target: surveyId, action: 'data_exported' } }),
    ).toBeGreaterThan(0);
  });
});
