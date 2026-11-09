import type { FastifyReply } from 'fastify';

/** Signed cookie holding the respondent's ID (signature: SESSION_SECRET via @fastify/cookie). */
export const SESSION_COOKIE = 'respondent';
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function startRespondentSession(
  reply: FastifyReply,
  respondentId: string,
  options: { secure: boolean },
): void {
  reply.setCookie(SESSION_COOKIE, respondentId, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}
