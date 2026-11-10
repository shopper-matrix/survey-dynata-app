import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeSignature, hasValidSignature, signUrl } from './signature.js';

// Example from Dynata's "Signed URL Start-End API" document (Aug 2025).
const dynataExample = {
  secret: 'x123f0ea789d06b456fd7a39a759ad1235d789a',
  url:
    'http://www.clientsurveydomain.com/?project=10001&psid=IM6mE1RikvPoIZZovY8ODQ**&_k=1234' +
    '&_s=ab7993ecd39ba46547561c2ee326593d87147e4fc9a3256dd0957a1564541e74',
};

const hmac = (message: string, secret: string) =>
  createHmac('sha256', secret).update(message).digest('hex');

describe('Dynata link signature', () => {
  it('reproduces the example from Dynata’s documentation', () => {
    expect(hasValidSignature(dynataExample.url, dynataExample.secret)).toBe(true);
  });

  it('signs the path and query exactly as written, without scheme, host and _s', () => {
    const url = 'https://survey.example.com/s/abc?project=7&psid=A*b**&_k=9';
    expect(computeSignature(url, 'secret')).toBe(
      hmac('/s/abc?project=7&psid=A*b**&_k=9', 'secret'),
    );
    expect(computeSignature(`${url}&_s=ignored`, 'secret')).toBe(computeSignature(url, 'secret'));
  });

  it('treats a URL without a path like "/"', () => {
    expect(computeSignature('https://example.com?a=1', 'k')).toBe(hmac('/?a=1', 'k'));
  });

  it('round-trips signUrl and hasValidSignature', () => {
    const signed = signUrl('http://localhost:3000/s/x?project=1&psid=P1&_k=key', 'secret');
    expect(signed).toMatch(/&_s=[0-9a-f]{64}$/);
    expect(hasValidSignature(signed, 'secret')).toBe(true);
  });

  it('rejects tampering, a wrong secret and a missing or malformed signature', () => {
    const signed = signUrl('http://localhost:3000/s/x?project=1&psid=P1&_k=key', 'secret');
    expect(hasValidSignature(signed.replace('psid=P1', 'psid=P2'), 'secret')).toBe(false);
    expect(hasValidSignature(signed, 'other-secret')).toBe(false);
    expect(hasValidSignature('http://localhost:3000/s/x?psid=P1', 'secret')).toBe(false);
    expect(hasValidSignature('http://localhost:3000/s/x?psid=P1&_s=xyz', 'secret')).toBe(false);
  });
});
