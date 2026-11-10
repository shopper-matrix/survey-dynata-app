import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

// Security headers for every API response (DSA-503). The API returns JSON and a few small HTML
// pages without scripts, so its policy allows no scripts at all; the respondent and admin app
// has its own policy (apps/web/vite.config.ts).

export const API_CONTENT_SECURITY_POLICY = {
  defaultSrc: ["'none'"],
  // The message pages carry one inline <style> block and no scripts.
  styleSrc: ["'unsafe-inline'"],
  imgSrc: ["'self'"],
  baseUri: ["'none'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

/** One year, as recommended for HSTS; browsers only honour it over HTTPS. */
const HSTS_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export async function registerSecurityHeaders(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: { useDefaults: false, directives: API_CONTENT_SECURITY_POLICY },
    strictTransportSecurity: { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true },
    // Respondents arrive from the panel's site; only send our origin on, never full URLs.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

/** Per client IP; generous for real people (one entry per invitation), tight for scripts. */
export const ENTRY_RATE_LIMIT = { max: 30, timeWindow: '1 minute' };
