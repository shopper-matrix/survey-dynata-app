import type { PrismaClient } from '@survey-dynata/shared/db/client';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { SampleProvider } from '../providers/sample-provider.js';
import { ENTRY_RATE_LIMIT } from './security.js';

const env = { APP_BASE_URL: 'https://survey.example', SESSION_SECRET: 'x'.repeat(32) };
const db = { $queryRaw: () => Promise.resolve(1) } as unknown as PrismaClient;
const app = () => buildApp({ db, env, provider: {} as SampleProvider });

describe('security headers (DSA-503)', () => {
  it('sends a strict CSP, HSTS and the other helmet headers on every response', async () => {
    const response = await (await app()).inject('/health');
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('script-src');
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('entry rate limit (DSA-503)', () => {
  it('answers 429 once one client opens too many entry links per minute', async () => {
    const server = await app();
    // A malformed survey ID is answered without touching the database.
    const enter = () => server.inject({ url: '/s/not-a-survey', remoteAddress: '192.0.2.5' });
    for (let i = 0; i < ENTRY_RATE_LIMIT.max; i++) expect((await enter()).statusCode).toBe(404);
    expect((await enter()).statusCode).toBe(429);
    // Other clients are not affected.
    const other = await server.inject({ url: '/s/not-a-survey', remoteAddress: '192.0.2.6' });
    expect(other.statusCode).toBe(404);
  });
});
