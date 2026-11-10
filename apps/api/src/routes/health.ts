import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance } from 'fastify';
import { getHealth } from '../health.js';

export function registerHealthRoute(app: FastifyInstance, db: PrismaClient): void {
  app.get('/health', async (_request, reply) => {
    const health = await getHealth(async () => {
      await db.$queryRaw`SELECT 1`;
    });
    return reply.code(health.status === 'ok' ? 200 : 503).send(health);
  });
}
