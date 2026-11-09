import { describe, expect, it } from 'vitest';
import { dynataEntryUrl } from './entry-url.js';

describe('dynataEntryUrl', () => {
  it('builds the survey link given to Dynata', () => {
    expect(dynataEntryUrl('https://survey.example.com', 'abc')).toBe(
      'https://survey.example.com/s/abc',
    );
  });

  it('ignores trailing slashes in the base URL', () => {
    expect(dynataEntryUrl('https://survey.example.com//', 'abc')).toBe(
      'https://survey.example.com/s/abc',
    );
  });
});
