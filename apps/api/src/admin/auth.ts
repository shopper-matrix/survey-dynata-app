import type { AdminRole } from '@survey-dynata/shared/db';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { resolveAdminSession, type AdminContext } from './sessions.js';

export const ADMIN_COOKIE = 'admin_session';

/** Owners can do everything, editors build surveys, viewers only read dashboards. */
const RANK: Record<AdminRole, number> = { viewer: 0, editor: 1, owner: 2 };

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminContext;
  }
}

/** Route guard: a valid, active admin session with at least `role`. */
export function requireAdmin(
  db: PrismaClient,
  role: AdminRole,
  idleMinutes: number,
): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const token = request.cookies[ADMIN_COOKIE];
    const admin = token ? await resolveAdminSession(db, token, idleMinutes) : null;
    if (!admin) {
      await reply.code(401).send({ error: 'not_signed_in' });
      return;
    }
    if (RANK[admin.role] < RANK[role]) {
      await reply.code(403).send({ error: 'forbidden' });
      return;
    }
    request.admin = admin;
  };
}

/** The admin set by requireAdmin (only use in guarded routes). */
export function adminOf(request: FastifyRequest): AdminContext {
  if (!request.admin) throw new Error('Route is missing the requireAdmin guard');
  return request.admin;
}

export function setAdminCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/api/admin',
  });
}

export function clearAdminCookie(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_COOKIE, { path: '/api/admin' });
}
