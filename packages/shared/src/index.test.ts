import { describe, expect, it } from 'vitest';
import { isNonEmptyString } from './index.js';

describe('isNonEmptyString', () => {
  it('accepts non-blank strings', () => {
    expect(isNonEmptyString('survey')).toBe(true);
  });

  it('rejects blank strings and non-strings', () => {
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
  });
});
