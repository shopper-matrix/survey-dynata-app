import { describe, expect, it } from 'vitest';
import { duplicateFlags, fingerprint } from './fingerprint.js';

const SECRET = 's'.repeat(32);
const browser = { 'user-agent': 'Mozilla/5.0 Phone', 'accept-language': 'de-DE' };

describe('fingerprint', () => {
  it('hashes IP and device without storing either in the clear', () => {
    const result = fingerprint(SECRET, '203.0.113.7', browser);
    expect(result.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.ipHash).not.toContain('203.0.113.7');
    expect(result).toEqual(fingerprint(SECRET, '203.0.113.7', browser));
  });

  it('changes with the IP, the device and the secret', () => {
    const base = fingerprint(SECRET, '203.0.113.7', browser);
    expect(fingerprint(SECRET, '203.0.113.8', browser).ipHash).not.toBe(base.ipHash);
    expect(
      fingerprint(SECRET, '203.0.113.7', { ...browser, 'user-agent': 'Other' }).deviceHash,
    ).not.toBe(base.deviceHash);
    expect(fingerprint('t'.repeat(32), '203.0.113.7', browser).ipHash).not.toBe(base.ipHash);
  });

  it('flags repeated IPs, and repeated IP plus device', () => {
    expect(duplicateFlags({ sameIp: 0, sameIpAndDevice: 0 })).toEqual([]);
    expect(duplicateFlags({ sameIp: 2, sameIpAndDevice: 0 })).toEqual(['duplicate_ip']);
    expect(duplicateFlags({ sameIp: 1, sameIpAndDevice: 1 })).toEqual([
      'duplicate_ip',
      'duplicate_device',
    ]);
  });
});

describe('repeated headers', () => {
  it('joins headers sent more than once', () => {
    const once = fingerprint(SECRET, '203.0.113.7', { 'accept-language': 'de,en' });
    const twice = fingerprint(SECRET, '203.0.113.7', { 'accept-language': ['de', 'en'] });
    expect(twice.deviceHash).toBe(once.deviceHash);
  });
});
