// Integration test: the entry endpoint against a real database, with mock Dynata (real HMAC).
import { randomUUID } from 'node:crypto';
import type { SurveyStatus } from '@survey-dynata/shared/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { createDb } from '../db.js';
import { createDynataClient } from '../dynata/client.js';
import { DYNATA_API_URL, DYNATA_END_URL, type DynataConfig } from '../dynata/config.js';
import { createDynataProvider } from '../dynata/provider.js';
import { signUrl } from '../dynata/signature.js';
import { loadEnv } from '../env.js';
import { SESSION_COOKIE } from '../http/session.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const BASE = 'http://localhost:5173';
const SESSION_SECRET = 'test-session-secret-with-32-chars!';
const dynata: DynataConfig = {
  mode: 'mock',
  keyId: 'k1',
  secret: 'mock-secret',
  apiUrl: DYNATA_API_URL,
  security: 'start-end',
  endUrl: DYNATA_END_URL,
  qualityFlag: '2',
};
const db = createDb(loadEnv().DATABASE_URL);
const surveys: Partial<Record<SurveyStatus, string>> = {};
let app: FastifyInstance;

async function appWith(fetchImpl?: typeof fetch, config = dynata) {
  const client = createDynataClient(config, {
    appBaseUrl: BASE,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
  return buildApp({
    db,
    env: { APP_BASE_URL: BASE, SESSION_SECRET },
    provider: createDynataProvider({ client, config, appBaseUrl: BASE }),
  });
}

/** A correctly signed entry path, as Dynata would send it. */
function entryPath(surveyId: string, psid: string, secret = dynata.secret): string {
  const signed = signUrl(`${BASE}/s/${surveyId}?project=10001&psid=${psid}&_k=k1`, secret);
  return signed.slice(BASE.length);
}

const enter = (url: string) =>
  app.inject({ method: 'GET', url, headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Mobile' } });

const respondentsFor = (surveyId: string, panelRespondentId: string) =>
  db.respondent.findMany({ where: { surveyId, panelRespondentId } });

beforeAll(async () => {
  for (const status of ['live', 'test', 'draft', 'closed'] as const) {
    const survey = await db.survey.create({
      data: { title: `entry test ${status} ${randomUUID()}`, targetCompletes: 10, status },
    });
    surveys[status] = survey.id;
  }
  app = await appWith();
});

afterAll(async () => {
  const ids = Object.values(surveys);
  await db.survey.deleteMany({ where: { id: { in: ids } } }); // cascades to respondents
  await app.close();
  await db.$disconnect();
});

const live = () => surveys.live ?? '';

describe('GET /s/:surveyId', () => {
  it('creates a respondent, sets a secure session cookie and redirects to the survey', async () => {
    const psid = `P-${randomUUID()}`;
    const response = await enter(entryPath(live(), psid));

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/survey');
    const [respondent] = await respondentsFor(live(), psid);
    expect(respondent).toMatchObject({ status: 'started', isTest: false, deviceType: 'phone' });

    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(app.unsignCookie(cookie?.value ?? '')).toEqual({
      valid: true,
      renew: false,
      value: respondent?.id,
    });
  });

  it('marks respondents of a survey in test mode as test data', async () => {
    const psid = `P-${randomUUID()}`;
    await enter(entryPath(surveys.test ?? '', psid));
    expect((await respondentsFor(surveys.test ?? '', psid))[0]?.isTest).toBe(true);
  });

  it('shows a friendly page for an unknown or malformed survey ID', async () => {
    for (const id of [randomUUID(), 'not-a-uuid']) {
      const response = await enter(entryPath(id, 'P-1'));
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Survey not found');
    }
  });

  it('shows a friendly page and creates nothing when the respondent ID is missing', async () => {
    const before = await db.respondent.count({ where: { surveyId: live() } });
    const response = await enter(`/s/${live()}?project=10001&_k=k1`);
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Link incomplete');
    expect(await db.respondent.count({ where: { surveyId: live() } })).toBe(before);
  });

  it('sends a link with an invalid signature to the invalid-signature link, creating nothing', async () => {
    const psid = `P-${randomUUID()}`;
    const response = await enter(entryPath(live(), psid, 'forged-secret'));
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('rst=2&svFlag=1');
    expect(await respondentsFor(live(), psid)).toHaveLength(0);
  });

  it('sends respondents of a survey that is not live to the over-quota link', async () => {
    for (const status of ['draft', 'closed'] as const) {
      const psid = `P-${randomUUID()}`;
      const response = await enter(entryPath(surveys[status] ?? '', psid));
      expect(response.headers.location).toContain('rst=3');
      expect(await respondentsFor(surveys[status] ?? '', psid)).toHaveLength(0);
    }
  });

  it('resumes a returning respondent who is still in progress', async () => {
    const psid = `P-${randomUUID()}`;
    await enter(entryPath(live(), psid));
    const again = await enter(entryPath(live(), psid));
    expect(again.headers.location).toBe('/survey');
    expect(again.cookies.some((c) => c.name === SESSION_COOKIE)).toBe(true);
    expect(await respondentsFor(live(), psid)).toHaveLength(1);
  });

  it('sends a respondent who already finished to the quality link', async () => {
    const psid = `P-${randomUUID()}`;
    await enter(entryPath(live(), psid));
    await db.respondent.updateMany({
      where: { surveyId: live(), panelRespondentId: psid },
      data: { status: 'complete' },
    });
    const again = await enter(entryPath(live(), psid));
    expect(again.headers.location).toContain('rst=2');
    expect(again.cookies.some((c) => c.name === SESSION_COOKIE)).toBe(false);
  });

  it('turns new entrants away while paused but lets respondents in progress resume', async () => {
    const inProgress = `P-${randomUUID()}`;
    await enter(entryPath(live(), inProgress));
    await db.survey.update({ where: { id: live() }, data: { pausedAt: new Date() } });
    try {
      const newcomer = `P-${randomUUID()}`;
      const turnedAway = await enter(entryPath(live(), newcomer));
      expect(turnedAway.headers.location).toContain('rst=3');
      expect(await respondentsFor(live(), newcomer)).toHaveLength(0);
      expect((await enter(entryPath(live(), inProgress))).headers.location).toBe('/survey');
    } finally {
      await db.survey.update({ where: { id: live() }, data: { pausedAt: null } });
    }
  });

  it('creates exactly one respondent for simultaneous requests', async () => {
    const psid = `P-${randomUUID()}`;
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => enter(entryPath(live(), psid))),
    );
    expect(responses.every((r) => r.headers.location === '/survey')).toBe(true);
    expect(await respondentsFor(live(), psid)).toHaveLength(1);
  });

  it('shows a friendly page and creates nothing when Dynata is unreachable', async () => {
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    const liveApp = await appWith(down, { ...dynata, mode: 'live' });
    const psid = `P-${randomUUID()}`;
    try {
      const response = await liveApp.inject({ method: 'GET', url: entryPath(live(), psid) });
      expect(response.statusCode).toBe(503);
      expect(response.body).toContain('Please try again shortly');
      expect(down).toHaveBeenCalledOnce();
      expect(await respondentsFor(live(), psid)).toHaveLength(0);
    } finally {
      await liveApp.close();
    }
  });
});

describe('duplicate protection (DSA-502)', () => {
  const from = (url: string, ip: string, userAgent: string) =>
    app.inject({ method: 'GET', url, remoteAddress: ip, headers: { 'user-agent': userAgent } });

  it('stores only salted hashes and flags repeated IPs and devices', async () => {
    const survey = await db.survey.create({
      data: { title: `dup ${randomUUID()}`, targetCompletes: 10, status: 'live' },
    });
    try {
      const phone = 'Mozilla/5.0 (iPhone) Mobile';
      const entrants = [
        ['A', '198.51.100.1', phone],
        ['B', '198.51.100.2', phone],
        ['C', '198.51.100.1', 'Mozilla/5.0 (Windows NT 10.0) Desktop'],
        ['D', '198.51.100.1', phone],
      ] as const;
      for (const [psid, ip, agent] of entrants) {
        await from(entryPath(survey.id, `P-${psid}`), ip, agent);
      }
      const stored = await db.respondent.findMany({
        where: { surveyId: survey.id },
        orderBy: { panelRespondentId: 'asc' },
      });
      expect(stored.map((r) => [r.panelRespondentId, r.qualityFlags])).toEqual([
        ['P-A', []],
        ['P-B', []],
        ['P-C', ['duplicate_ip']],
        ['P-D', ['duplicate_ip', 'duplicate_device']],
      ]);
      expect(stored[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(stored)).not.toContain('198.51.100');
      // A duplicate Dynata ID is still blocked by the unique index: no second row.
      await from(entryPath(survey.id, 'P-A'), '198.51.100.9', phone);
      expect(await db.respondent.count({ where: { surveyId: survey.id } })).toBe(4);
    } finally {
      await db.survey.delete({ where: { id: survey.id } });
    }
  });
});
