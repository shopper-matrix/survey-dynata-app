// Integration test: test links run the real flow, end on an internal page, are not counted and
// can be deleted in one go.
import { randomUUID } from 'node:crypto';
import { surveyDefinitionSchema } from '@survey-dynata/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE } from '../admin/auth.js';
import { createAdminSession } from '../admin/sessions.js';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { createDynataClient } from '../dynata/client.js';
import { DYNATA_API_URL, type DynataConfig } from '../dynata/config.js';
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
const dynata: DynataConfig = { mode: 'mock', keyId: 'k', secret: 's', apiUrl: DYNATA_API_URL };
let app: FastifyInstance;
let adminCookie: string;
let adminId: string;

beforeAll(async () => {
  const definition = surveyDefinitionSchema.parse({
    survey: { id: surveyId, title: 'Test links', language: 'en', targetCompletes: 5 },
    blocks: [
      {
        code: 'A',
        title: 'A',
        questions: [{ code: 'I1', type: 'info', text: 'Hello', config: { body: 'Hi' } }],
      },
    ],
    quotas: [{ name: 'All', target: 5, conditions: { question: 'I1', op: 'in', value: ['x'] } }],
  });
  await db.$transaction((tx) => importSurvey(tx, definition, { status: 'live' }));
  app = await buildApp({
    db,
    env: { APP_BASE_URL: BASE, SESSION_SECRET: 'x'.repeat(32) },
    provider: createDynataProvider({
      client: createDynataClient(dynata, { appBaseUrl: BASE }),
      config: dynata,
      appBaseUrl: BASE,
    }),
  });
  const admin = await db.adminUser.create({
    data: { email: `tester-${randomUUID()}@example.test`, role: 'editor', passwordHash: 'unused' },
  });
  adminId = admin.id;
  adminCookie = `${ADMIN_COOKIE}=${await createAdminSession(db, admin.id)}`;
});

afterAll(async () => {
  await db.answer.deleteMany({ where: { respondent: { surveyId } } });
  await db.survey.deleteMany({ where: { id: surveyId } });
  await db.adminAuditLog.deleteMany({ where: { adminUserId: adminId } });
  await db.adminUser.delete({ where: { id: adminId } });
  await app.close();
  await db.$disconnect();
});

describe('test links', () => {
  it('runs a test respondent through the real flow and ends on the internal page', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/admin/surveys/${surveyId}/test-links`,
      headers: { cookie: adminCookie },
      payload: { count: 2 },
    });
    const { links } = created.json<{ links: string[] }>();
    expect(links).toHaveLength(2);
    expect(links[0]).toMatch(
      new RegExp(`^${BASE}/s/${surveyId}\\?psid=TEST-[0-9A-F]{10}&_k=k&_s=`),
    );

    const entry = await app.inject((links[0] ?? '').slice(BASE.length));
    expect(entry.headers.location).toBe('/survey');
    const cookie = entry.cookies.find((c) => c.name === SESSION_COOKIE);
    const headers = { cookie: `${SESSION_COOKIE}=${cookie?.value ?? ''}` };
    const respondent = await db.respondent.findFirstOrThrow({
      where: { surveyId, panelRespondentId: { startsWith: 'TEST-' } },
    });
    expect(respondent.isTest).toBe(true);

    await app.inject({
      method: 'POST',
      url: '/api/session/answers',
      headers,
      payload: { questionCode: 'I1', value: { seen: true } },
    });
    const finished = await app.inject({ method: 'POST', url: '/api/session/finish', headers });
    const { redirectUrl } = finished.json<{ redirectUrl: string }>();
    expect(redirectUrl).toMatch(/^\/api\/test-end\?outcome=complete&target=/);

    const page = await app.inject(redirectUrl);
    expect(page.body).toContain('Test finished: complete');
    expect(page.body).toContain('/mock-dynata/end?rst=1');

    // The real provider link is still what gets logged; quotas are not touched.
    const log = await db.redirectLog.findFirstOrThrow({ where: { respondentId: respondent.id } });
    expect(log.url).toContain('/mock-dynata/end?rst=1');
    const quota = await db.quotaCell.findFirstOrThrow({ where: { surveyId } });
    expect(quota.currentCount).toBe(0);
  });

  it('deletes all test data in one call and keeps real respondents', async () => {
    const real = await db.respondent.create({ data: { surveyId, panelRespondentId: 'REAL-1' } });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/surveys/${surveyId}/test-data`,
      headers: { cookie: adminCookie },
    });
    expect(response.json<{ deleted: number }>().deleted).toBeGreaterThanOrEqual(1);
    expect(await db.respondent.count({ where: { surveyId, isTest: true } })).toBe(0);
    expect(await db.respondent.count({ where: { id: real.id } })).toBe(1);
  });
});
