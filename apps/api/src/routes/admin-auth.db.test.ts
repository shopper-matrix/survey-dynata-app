// Integration test: admin login, roles, inactivity timeout and audit log.
import { randomUUID } from 'node:crypto';
import type { AdminRole } from '@survey-dynata/shared/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_COOKIE } from '../admin/auth.js';
import { hashPassword } from '../admin/passwords.js';
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
const password = 'correct horse battery staple';
const emails: Record<AdminRole, string> = {
  owner: `owner-${run}@example.test`,
  editor: `editor-${run}@example.test`,
  viewer: `viewer-${run}@example.test`,
};
let app: FastifyInstance;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const [role, email] of Object.entries(emails)) {
    await db.adminUser.create({ data: { email, role: role as AdminRole, passwordHash } });
  }
  app = await buildApp({
    db,
    env: { APP_BASE_URL: 'https://survey.example.com', SESSION_SECRET: 'x'.repeat(32) },
    provider: {} as SampleProvider,
  });
});

afterAll(async () => {
  const admins = await db.adminUser.findMany({ where: { email: { in: Object.values(emails) } } });
  await db.adminAuditLog.deleteMany({
    where: {
      OR: [
        { adminUserId: { in: admins.map((a) => a.id) } },
        { target: { in: Object.values(emails) } },
      ],
    },
  });
  await db.adminUser.deleteMany({ where: { email: { in: Object.values(emails) } } });
  await app.close();
  await db.$disconnect();
});

async function login(email: string, pass = password) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { email, password: pass },
  });
  const cookie = response.cookies.find((c) => c.name === ADMIN_COOKIE);
  return { response, cookie, header: cookie ? `${ADMIN_COOKIE}=${cookie.value}` : '' };
}

describe('admin authentication', () => {
  it('signs in with email and password and sets a strict, HttpOnly, Secure cookie', async () => {
    const { response, cookie, header } = await login(emails.editor.toUpperCase());
    expect(response.json()).toEqual({ email: emails.editor, role: 'editor' });
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/api/admin',
    });
    const me = await app.inject({ url: '/api/admin/me', headers: { cookie: header } });
    expect(me.json()).toEqual({ email: emails.editor, role: 'editor' });
  });

  it('rejects a wrong password or unknown email the same way, and logs it', async () => {
    const wrong = await login(emails.owner, 'nope');
    const unknown = await login(`nobody-${run}@example.test`);
    expect(wrong.response.statusCode).toBe(401);
    expect(unknown.response.json()).toEqual(wrong.response.json());
    expect(wrong.cookie).toBeUndefined();
    expect(
      await db.adminAuditLog.count({ where: { action: 'login_failed', target: emails.owner } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it('enforces roles: only owners read the audit log', async () => {
    const viewer = await login(emails.viewer);
    const owner = await login(emails.owner);
    const asViewer = await app.inject({
      url: '/api/admin/audit-log',
      headers: { cookie: viewer.header },
    });
    const asOwner = await app.inject({
      url: '/api/admin/audit-log',
      headers: { cookie: owner.header },
    });
    expect(asViewer.statusCode).toBe(403);
    expect(asOwner.statusCode).toBe(200);
    expect(asOwner.json<{ action: string }[]>().some((entry) => entry.action === 'login')).toBe(
      true,
    );
  });

  it('ends a session after inactivity', async () => {
    const { header, cookie } = await login(emails.viewer);
    const session = await db.adminSession.findFirstOrThrow({
      where: { adminUser: { email: emails.viewer } },
      orderBy: { createdAt: 'desc' },
    });
    await db.adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) },
    });
    const me = await app.inject({ url: '/api/admin/me', headers: { cookie: header } });
    expect(me.statusCode).toBe(401);
    expect(cookie).toBeDefined();
    expect(await db.adminSession.count({ where: { id: session.id } })).toBe(0);
  });

  it('logs out and invalidates the session', async () => {
    const { header } = await login(emails.owner);
    const out = await app.inject({
      method: 'POST',
      url: '/api/admin/logout',
      headers: { cookie: header },
    });
    expect(out.json()).toEqual({ ok: true });
    const me = await app.inject({ url: '/api/admin/me', headers: { cookie: header } });
    expect(me.statusCode).toBe(401);
  });

  it('requires a session for admin routes', async () => {
    expect((await app.inject('/api/admin/me')).statusCode).toBe(401);
    const forged = await app.inject({
      url: '/api/admin/me',
      headers: { cookie: `${ADMIN_COOKIE}=forged-token` },
    });
    expect(forged.statusCode).toBe(401);
  });
});
