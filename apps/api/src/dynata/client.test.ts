import { describe, expect, it, vi } from 'vitest';
import { createDynataClient, DynataApiError } from './client.js';
import { DYNATA_API_URL, type DynataConfig } from './config.js';
import { hasValidSignature, signUrl } from './signature.js';

const APP = 'http://localhost:3000';
const mockConfig: DynataConfig = {
  mode: 'mock',
  keyId: 'k1',
  secret: 'mock-secret',
  apiUrl: DYNATA_API_URL,
};
const entry = (keyId = 'k1', secret = 'mock-secret') =>
  signUrl(`${APP}/s/survey-1?project=10001&psid=P-42&_k=${keyId}`, secret);

describe('mock Dynata client', () => {
  const client = createDynataClient(mockConfig, { appBaseUrl: APP });

  it('verifies a correctly signed entry link and returns signed local end links', async () => {
    const links = await client.buildAndValidate(entry());
    expect(links.verification).toBe('success');
    expect(links.completeLink).toMatch(
      /^http:\/\/localhost:3000\/mock-dynata\/end\?rst=1&psid=P-42&_s=/,
    );
    expect(links.screenOutLink).toContain('rst=2&psid=P-42&_s=');
    expect(links.overQuotaLink).toContain('rst=3&psid=P-42&_s=');
    expect(links.invalidSignatureLink).toContain('rst=2&svFlag=1&psid=P-42&_s=');
    for (const link of Object.values(links).slice(1)) {
      expect(hasValidSignature(link, mockConfig.secret)).toBe(true);
    }
  });

  it('fails verification for a wrong key ID, a wrong secret or a tampered link', async () => {
    const results = await Promise.all([
      client.buildAndValidate(entry('other-key')),
      client.buildAndValidate(entry('k1', 'wrong-secret')),
      client.buildAndValidate(entry().replace('psid=P-42', 'psid=P-43')),
    ]);
    expect(results.map((links) => links.verification)).toEqual(['failure', 'failure', 'failure']);
  });
});

describe('live Dynata client', () => {
  const liveConfig: DynataConfig = { ...mockConfig, mode: 'live', keyId: '1234', secret: 's3cret' };
  const response = {
    verification: 'success',
    expectedSignature: 'abc',
    errorMessage: '',
    completeLink: 'https://dynata.example/end?rst=1&_s=1',
    screenOutLink: 'https://dynata.example/end?rst=2&_s=2',
    overQuotaLink: 'https://dynata.example/end?rst=3&_s=3',
    invalidSignatureLink: 'https://dynata.example/end?rst=2&svFlag=1&_s=4',
  };

  it('posts key ID, secret and entry URL to the buildAndValidate API', async () => {
    const fetchStub = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
    const client = createDynataClient(liveConfig, { appBaseUrl: APP, fetch: fetchStub });

    const links = await client.buildAndValidate('https://us.example/s/x?psid=1&_k=1234&_s=f');

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(url).toBe(DYNATA_API_URL);
    expect(init?.method).toBe('POST');
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      keyId: '1234',
      secret: 's3cret',
      url: 'https://us.example/s/x?psid=1&_k=1234&_s=f',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(links).toEqual({
      verification: 'success',
      completeLink: response.completeLink,
      screenOutLink: response.screenOutLink,
      overQuotaLink: response.overQuotaLink,
      invalidSignatureLink: response.invalidSignatureLink,
    });
  });

  it('throws DynataApiError on network errors, HTTP errors and unexpected responses', async () => {
    const failing = [
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('down', { status: 503 })),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ verification: 'maybe' })),
    ];
    for (const fetchStub of failing) {
      const client = createDynataClient(liveConfig, { appBaseUrl: APP, fetch: fetchStub });
      await expect(client.buildAndValidate('https://us.example/s/x?psid=1')).rejects.toBeInstanceOf(
        DynataApiError,
      );
    }
  });
});
