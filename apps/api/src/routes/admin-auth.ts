import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../admin/audit.js';
import { adminOf, clearAdminCookie, requireAdmin, setAdminCookie } from '../admin/auth.js';
import { timingDummyHash, verifyPassword } from '../admin/passwords.js';
import { createAdminSession, endAdminSession } from '../admin/sessions.js';

const loginSchema = z.strictObject({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(200),
});

export interface AdminAuthOptions {
  db: PrismaClient;
  secureCookies: boolean;
  idleMinutes: number;
}

export function registerAdminAuthRoutes(app: FastifyInstance, options: AdminAuthOptions): void {
  const { db, secureCookies, idleMinutes } = options;

  app.post(
    '/api/admin/login',
    // Slows down password guessing per client address.
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = loginSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

      const admin = await db.adminUser.findUnique({ where: { email: body.data.email } });
      const valid = await verifyPassword(
        admin?.passwordHash ?? (await timingDummyHash),
        body.data.password,
      );
      if (!admin || !valid) {
        await audit(db, null, 'login_failed', body.data.email);
        return reply.code(401).send({ error: 'invalid_credentials' });
      }

      setAdminCookie(reply, await createAdminSession(db, admin.id), secureCookies);
      await audit(db, admin.id, 'login');
      return { email: admin.email, role: admin.role };
    },
  );

  const signedIn = requireAdmin(db, 'viewer', idleMinutes);

  app.get('/api/admin/me', { preHandler: signedIn }, (request) => {
    const { email, role } = adminOf(request);
    return { email, role };
  });

  app.post('/api/admin/logout', { preHandler: signedIn }, async (request, reply) => {
    const admin = adminOf(request);
    await endAdminSession(db, admin.sessionId);
    await audit(db, admin.id, 'logout');
    clearAdminCookie(reply);
    return { ok: true };
  });

  app.get(
    '/api/admin/audit-log',
    { preHandler: requireAdmin(db, 'owner', idleMinutes) },
    async () =>
      db.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { adminUser: { select: { email: true } } },
      }),
  );
}
