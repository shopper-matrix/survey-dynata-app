import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMockEndPage } from './mock-end-page.js';
import { signUrl } from './signature.js';

const BASE = 'http://localhost:5173';
const SECRET = 'mock-secret';

async function page(query: string, sign = true) {
  const app = Fastify();
  registerMockEndPage(app, { appBaseUrl: `${BASE}/`, secret: SECRET });
  const path = `/mock-dynata/end?${query}`;
  const url = sign ? signUrl(`${BASE}${path}`, SECRET).slice(BASE.length) : path;
  return (await app.inject(url)).body;
}

describe('mock Dynata end page', () => {
  it.each([
    ['rst=1&psid=P-1', 'Complete'],
    ['rst=2&psid=P-1', 'Screen-out'],
    ['rst=3&psid=P-1', 'Over-quota'],
    ['rst=2&qflag=1&psid=P-1', 'Quality termination'],
    ['rst=2&qFlag=1&psid=P-1&_k=k', 'Quality termination'],
    ['rst=2&svFlag=1&psid=P-1', 'Invalid entry signature'],
    ['rst=9&psid=P-1', 'Unknown result code'],
  ])('names the outcome of %s', async (query, outcome) => {
    const body = await page(query);
    expect(body).toContain(`Mock Dynata: ${outcome}`);
    expect(body).toContain('Signature: valid');
  });

  it('shows an unsigned link and a missing respondent ID', async () => {
    const body = await page('rst=1', false);
    expect(body).toContain('Respondent ?');
    expect(body).toContain('Signature: INVALID');
  });
});
