// Integration test: per-survey Dynata settings in the admin API.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE } from '../admin/auth.js';
import { createAdminSession } from '../admin/sessions.js';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { createDynataClient } from './client.js';
import { DYNATA_API_URL, type DynataConfig } from './config.js';
import { createDynataProvider } from './provider.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const BASE = 'http://localhost:5173';
const db = createDb(loadEnv().DATABASE_URL);
const dynata: DynataConfig = { mode: 'mock', keyId: 'k', secret: 's', apiUrl: DYNATA_API_URL };
const surveyIds: string[] = [];
const adminIds: string[] = [];
const cookies: Record<string, string> = {};
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({
    db,
    env: { APP_BASE_URL: BASE, SESSION_SECRET: 'x'.repeat(32) },
    provider: createDynataProvider({
      client: createDynataClient(dynata, { appBaseUrl: BASE }),
      config: dynata,
      appBaseUrl: BASE,
    }),
  });
  for (const role of ['editor', 'viewer'] as const) {
    const admin = await db.adminUser.create({
      data: { email: `${role}-dyn-${randomUUID()}@example.test`, role, passwordHash: 'unused' },
    });
    adminIds.push(admin.id);
    cookies[role] = `${ADMIN_COOKIE}=${await createAdminSession(db, admin.id)}`;
  }
  for (let i = 0; i < 2; i++) {
    const survey = await db.survey.create({
      data: { title: `Dynata ${String(i)}`, targetCompletes: 1 },
    });
    surveyIds.push(survey.id);
  }
});

afterAll(async () => {
  await db.survey.deleteMany({ where: { id: { in: surveyIds } } });
  await db.adminAuditLog.deleteMany({ where: { adminUserId: { in: adminIds } } });
  await db.adminUser.deleteMany({ where: { id: { in: adminIds } } });
  await app.close();
  await db.$disconnect();
});

const settings = (role: string, id: string, payload?: { projectId: string }) =>
  payload
    ? app.inject({
        method: 'PUT',
        url: `/api/admin/surveys/${id}/dynata`,
        headers: { cookie: cookies[role] ?? '' },
        payload,
      })
    : app.inject({
        url: `/api/admin/surveys/${id}/dynata`,
        headers: { cookie: cookies[role] ?? '' },
      });

describe('Dynata settings (DSA-604)', () => {
  it('stores the project ID per survey and never exposes credentials', async () => {
    const [first] = surveyIds;
    expect((await settings('viewer', first ?? '')).json()).toEqual({
      projectId: null,
      mode: 'mock',
      keyConfigured: false,
    });
    const saved = await settings('editor', first ?? '', { projectId: ' DYN-1 ' });
    expect(saved.json()).toEqual({ projectId: 'DYN-1', mode: 'mock', keyConfigured: false });
    expect(saved.body).not.toContain('"s"');
  });

  it('refuses a project ID already used by another survey, and viewers cannot edit', async () => {
    const [, second] = surveyIds;
    expect((await settings('editor', second ?? '', { projectId: 'DYN-1' })).statusCode).toBe(409);
    expect((await settings('viewer', second ?? '', { projectId: 'DYN-2' })).statusCode).toBe(403);
  });

  it('shows the entry URL and quota counts with the survey', async () => {
    const [first] = surveyIds;
    const details = await app.inject({
      url: `/api/admin/surveys/${first ?? ''}`,
      headers: { cookie: cookies.viewer ?? '' },
    });
    expect(details.json()).toMatchObject({ entryUrl: `${BASE}/s/${first ?? ''}`, quotaCounts: {} });
  });
});
