import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DYNATA_END_URL } from './config.js';
import { endLinkFor } from './end-links.js';
import { hasValidSignature } from './signature.js';

const config = { keyId: '1234', secret: 's3cret', qualityFlag: '2' };

describe('End-mode links (Dynata Secured Links End)', () => {
  it('builds rst, psid and _k in Dynata order with the signature last', () => {
    const url = endLinkFor(config, DYNATA_END_URL, 'ABC-1', 'complete');
    const expected = createHmac('sha256', 's3cret')
      .update('/projects/end?rst=1&psid=ABC-1&_k=1234')
      .digest('hex');
    expect(url).toBe(`${DYNATA_END_URL}?rst=1&psid=ABC-1&_k=1234&_s=${expected}`);
  });

  it('uses Dynata result codes for every outcome', () => {
    const query = (outcome: Parameters<typeof endLinkFor>[3]) =>
      new URL(endLinkFor(config, DYNATA_END_URL, 'P', outcome)).search;
    expect(query('complete')).toMatch(/^\?rst=1&psid=P&_k=1234&_s=/);
    expect(query('screenout')).toMatch(/^\?rst=2&psid=P&_k=1234&_s=/);
    expect(query('overquota')).toMatch(/^\?rst=3&psid=P&_k=1234&_s=/);
    expect(query('quality')).toMatch(/^\?rst=2&qFlag=2&psid=P&_k=1234&_s=/);
  });

  it('signs a different link per respondent, verifiable with the secret only', () => {
    const a = endLinkFor(config, DYNATA_END_URL, 'A', 'complete');
    const b = endLinkFor(config, DYNATA_END_URL, 'B', 'complete');
    expect(new URL(a).searchParams.get('_s')).not.toBe(new URL(b).searchParams.get('_s'));
    expect(hasValidSignature(a, 's3cret')).toBe(true);
    expect(hasValidSignature(a, 'other')).toBe(false);
  });

  it('encodes unusual characters in the respondent ID before signing', () => {
    const url = endLinkFor(config, DYNATA_END_URL, 'a b&c', 'complete');
    expect(url).toContain('psid=a%20b%26c&_k=1234');
    expect(new URL(url).searchParams.get('psid')).toBe('a b&c');
    expect(hasValidSignature(url, 's3cret')).toBe(true);
  });
});
