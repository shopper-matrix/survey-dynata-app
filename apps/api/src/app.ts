import cookie from '@fastify/cookie';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './env.js';
import type { SampleProvider } from './providers/sample-provider.js';
import { applyQuotasOnComplete } from './quotas/quotas.js';
import { registerEntryRoute } from './routes/entry.js';
import { registerHealthRoute } from './routes/health.js';
import { registerSessionRoutes } from './routes/session.js';

export interface AppDependencies {
  db: PrismaClient;
  env: Pick<Env, 'APP_BASE_URL' | 'SESSION_SECRET'>;
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

  registerHealthRoute(app, db);
  registerEntryRoute(app, { db, provider, appBaseUrl: env.APP_BASE_URL });
  registerSessionRoutes(app, { db, provider, beforeEnd: applyQuotasOnComplete });
  provider.registerRoutes?.(app);

  return app;
}
