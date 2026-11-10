import { createHash, randomBytes } from 'node:crypto';
import type { AdminRole } from '@survey-dynata/shared/db';
import type { PrismaClient } from '@survey-dynata/shared/db/client';

// Server-side admin sessions: the cookie holds a random token; the database stores its hash.
// A session ends after `idleMinutes` without requests.

export interface AdminContext {
  id: string;
  email: string;
  role: AdminRole;
  sessionId: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createAdminSession(db: PrismaClient, adminUserId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.adminSession.create({ data: { adminUserId, tokenHash: hashToken(token) } });
  return token;
}

/** The admin behind a session token, refreshing its activity time; null if unknown or idle. */
export async function resolveAdminSession(
  db: PrismaClient,
  token: string,
  idleMinutes: number,
): Promise<AdminContext | null> {
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: { select: { id: true, email: true, role: true } } },
  });
  if (!session) return null;
  if (Date.now() - session.lastSeenAt.getTime() > idleMinutes * 60_000) {
    await db.adminSession.delete({ where: { id: session.id } });
    return null;
  }
  await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { ...session.adminUser, sessionId: session.id };
}

export async function endAdminSession(db: PrismaClient, sessionId: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { id: sessionId } });
}
