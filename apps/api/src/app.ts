import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './env.js';
import type { SampleProvider } from './providers/sample-provider.js';
import { applyQuotasOnComplete } from './quotas/quotas.js';
import { registerAdminAuthRoutes } from './routes/admin-auth.js';
import { registerAdminExportRoutes } from './routes/admin-export.js';
import { registerAdminSurveyRoutes } from './routes/admin-surveys.js';
import { registerAdminTestLinkRoutes } from './routes/admin-test-links.js';
import { registerEntryRoute } from './routes/entry.js';
import { registerHealthRoute } from './routes/health.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerTestEndPage } from './test-links/test-links.js';

export interface AppDependencies {
  db: PrismaClient;
  env: Pick<Env, 'APP_BASE_URL' | 'SESSION_SECRET'> &
    Partial<Pick<Env, 'ADMIN_SESSION_IDLE_MINUTES'>>;
  provider: SampleProvider;
  logger?: boolean;
}

/** Builds the API without starting it, so tests can call it in-process. */
export async function buildApp({
  db,
  env,
  provider,
  logger = false,
}: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  // Opt-in per route (login, entry links).
  await app.register(rateLimit, { global: false });
  const secureCookies = env.APP_BASE_URL.startsWith('https://');

  registerHealthRoute(app, db);
  registerEntryRoute(app, { db, provider, appBaseUrl: env.APP_BASE_URL });
  registerSessionRoutes(app, { db, provider, beforeEnd: applyQuotasOnComplete });
  provider.registerRoutes?.(app);
  const idleMinutes = env.ADMIN_SESSION_IDLE_MINUTES ?? 30;
  registerAdminAuthRoutes(app, { db, secureCookies, idleMinutes });
  registerAdminSurveyRoutes(app, { db, idleMinutes });
  registerAdminTestLinkRoutes(app, { db, provider, appBaseUrl: env.APP_BASE_URL, idleMinutes });
  registerAdminExportRoutes(app, { db, idleMinutes });
  registerTestEndPage(app);

  return app;
}
