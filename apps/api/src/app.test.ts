import type { PrismaClient } from '@survey-dynata/shared/db/client';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { SampleProvider } from './providers/sample-provider.js';

const env = { APP_BASE_URL: 'http://localhost:5173', SESSION_SECRET: 'x'.repeat(32) };
const provider = {} as SampleProvider;
const dbAnswering = (query: () => Promise<unknown>) =>
  ({ $queryRaw: query }) as unknown as PrismaClient;

describe('GET /health', () => {
  it('reports ok when the database answers', async () => {
    const app = await buildApp({ db: dbAnswering(() => Promise.resolve(1)), env, provider });
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('answers 503 when the database is unreachable', async () => {
    const app = await buildApp({
      db: dbAnswering(() => Promise.reject(new Error('down'))),
      env,
      provider,
    });
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'degraded', database: 'unreachable' });
  });
});
