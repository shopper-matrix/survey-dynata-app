import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../providers/sample-provider.js';
import { DynataApiError, type DynataClient } from './client.js';
import { DYNATA_API_URL, DYNATA_END_URL, type DynataConfig } from './config.js';
import { createDynataProvider } from './provider.js';
import { hasValidSignature } from './signature.js';

const links = {
  verification: 'success' as 'success' | 'failure',
  completeLink: 'https://d.example/end?rst=1',
  screenOutLink: 'https://d.example/end?rst=2',
  overQuotaLink: 'https://d.example/end?rst=3',
  invalidSignatureLink: 'https://d.example/end?rst=2&svFlag=1',
};
const config: DynataConfig = {
  mode: 'mock',
  keyId: 'k',
  secret: 's',
  apiUrl: DYNATA_API_URL,
  security: 'start-end',
  endUrl: DYNATA_END_URL,
  qualityFlag: '2',
};
const make = (result: () => Promise<typeof links>, mode: DynataConfig['mode'] = 'mock') =>
  createDynataProvider({
    client: { buildAndValidate: result } satisfies DynataClient,
    config: { ...config, mode },
    appBaseUrl: 'http://localhost:5173',
  });

describe('Dynata sample provider', () => {
  it('reads psid as the respondent ID', () => {
    const provider = make(() => Promise.resolve(links));
    expect(provider.respondentId(new URL('https://x/s/1?project=1&psid=AB*1'))).toBe('AB*1');
    expect(provider.respondentId(new URL('https://x/s/1?psid=%20'))).toBeNull();
    expect(provider.respondentId(new URL('https://x/s/1?project=1'))).toBeNull();
  });

  it('maps Dynata links to outcomes; quality uses the screen-out link for now', async () => {
    const provider = make(() => Promise.resolve(links));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).resolves.toEqual({
      verified: true,
      endLinks: {
        complete: links.completeLink,
        screenout: links.screenOutLink,
        overquota: links.overQuotaLink,
        quality: links.screenOutLink,
      },
      invalidLink: links.invalidSignatureLink,
    });
  });

  it('turns API errors into ProviderUnavailableError', async () => {
    const provider = make(() => Promise.reject(new DynataApiError('down')));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('rethrows unexpected errors from the client unchanged', async () => {
    const bug = new TypeError('bug');
    const provider = make(() => Promise.reject(bug));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).rejects.toBe(bug);
  });

  it('reports a failed verification with the invalid-signature link', async () => {
    const provider = make(() => Promise.resolve({ ...links, verification: 'failure' as const }));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).resolves.toMatchObject({
      verified: false,
      invalidLink: links.invalidSignatureLink,
    });
  });

  it('signs mock end links per outcome and refuses live end links until DSA-304', () => {
    const respondent = { panelRespondentId: 'P-1' };
    const complete = make(() => Promise.resolve(links)).endLink(respondent, 'complete');
    expect(complete).toContain('/mock-dynata/end?');
    expect(complete).toContain('rst=1');
    expect(hasValidSignature(complete, config.secret)).toBe(true);
    expect(() =>
      make(() => Promise.resolve(links), 'live').endLink(respondent, 'complete'),
    ).toThrow(/DSA-304/);
  });

  it('builds signed test entry links with the client key ID', () => {
    const url = make(() => Promise.resolve(links)).testEntryUrl(
      'http://localhost:5173/s/1',
      'TEST-1',
    );
    const params = new URL(url).searchParams;
    expect(params.get('psid')).toBe('TEST-1');
    expect(params.get('_k')).toBe('k');
    expect(hasValidSignature(url, config.secret)).toBe(true);
  });

  it('registers the mock end page only in mock mode', () => {
    expect('registerRoutes' in make(() => Promise.resolve(links))).toBe(true);
    expect('registerRoutes' in make(() => Promise.resolve(links), 'live')).toBe(false);
  });
});

describe('Dynata sample provider in End mode', () => {
  const endConfig: DynataConfig = { ...config, security: 'end' };
  const unusedClient: DynataClient = {
    buildAndValidate: () => Promise.reject(new Error('End mode must not call the API')),
  };
  const make = (mode: DynataConfig['mode']) =>
    createDynataProvider({
      client: unusedClient,
      config: { ...endConfig, mode },
      appBaseUrl: 'http://localhost:5173/',
    });

  it('accepts unsigned entry links and builds the signed end links without the API', async () => {
    const result = await make('live').verifyEntry('https://x/s/1?psid=P-1&age=30');
    expect(result.verified).toBe(true);
    expect(result.endLinks.complete).toMatch(
      /^https:\/\/dkr1\.ssisurveys\.com\/projects\/end\?rst=1&psid=P-1&_k=k&_s=[0-9a-f]{64}$/,
    );
    expect(result.endLinks.quality).toContain('?rst=2&qflag=2&psid=P-1&_k=k&_s=');
    expect(hasValidSignature(result.endLinks.overquota, config.secret)).toBe(true);
  });

  it('signs live end links on finish with the same link as at entry', async () => {
    const provider = make('live');
    const atEntry = await provider.verifyEntry('https://x/s/1?psid=P-1');
    expect(provider.endLink({ panelRespondentId: 'P-1' }, 'screenout')).toBe(
      atEntry.endLinks.screenout,
    );
  });

  it('points mock end links at the local end page', () => {
    const link = make('mock').endLink({ panelRespondentId: 'P-1' }, 'complete');
    expect(link).toMatch(/^http:\/\/localhost:5173\/mock-dynata\/end\?rst=1&psid=P-1&_k=k&_s=/);
    expect(hasValidSignature(link, config.secret)).toBe(true);
  });

  it('builds unsigned test entry links', () => {
    expect(make('mock').testEntryUrl('http://localhost:5173/s/1', 'TEST-1')).toBe(
      'http://localhost:5173/s/1?psid=TEST-1',
    );
  });
});
