import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyBaseLogger } from 'fastify';
import { runRetention } from './retention.js';

/** The job runs at start-up and then daily; deletions are due by the day, so this is enough. */
export const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Starts the daily retention job inside the API process; returns a function that stops it. */
export function scheduleRetention(db: PrismaClient, log: FastifyBaseLogger): () => void {
  const run = () =>
    runRetention(db).then(
      (result) => {
        log.info(
          { respondentsDeleted: result.respondentsDeleted, answersDeleted: result.answersDeleted },
          'Retention job finished',
        );
      },
      (error: unknown) => {
        log.error({ err: error }, 'Retention job failed');
      },
    );
  void run();
  const timer = setInterval(() => void run(), RETENTION_INTERVAL_MS);
  // Never keeps the process alive on its own (shutdown, tests).
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
