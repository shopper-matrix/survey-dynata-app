import { describe, expect, it, vi } from 'vitest';
import { createTurnstile } from './turnstile.js';

const keys = { siteKey: 'site', secretKey: 'secret' };

describe('Turnstile bot check', () => {
  it('is off without keys', async () => {
    const check = createTurnstile({});
    expect(check.siteKey).toBeNull();
    expect(await check.verify(undefined, '1.2.3.4')).toBe(true);
  });

  it('verifies the token with Cloudflare', async () => {
    const fetchStub = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true }));
    const check = createTurnstile({ ...keys, fetch: fetchStub });
    expect(await check.verify('token', '1.2.3.4')).toBe(true);
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect((init?.body as URLSearchParams).toString()).toBe(
      'secret=secret&response=token&remoteip=1.2.3.4',
    );
  });

  it('fails closed on a missing token, a rejected token or a network error', async () => {
    const rejecting = createTurnstile({
      ...keys,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: false })),
    });
    const offline = createTurnstile({
      ...keys,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')),
    });
    expect(await rejecting.verify(undefined, '1.2.3.4')).toBe(false);
    expect(await rejecting.verify('token', '1.2.3.4')).toBe(false);
    expect(await offline.verify('token', '1.2.3.4')).toBe(false);
  });
});
