import { describe, expect, it } from 'vitest';
import { surveyEntryUrl } from './entry-url.js';

describe('surveyEntryUrl', () => {
  it('builds the survey link given to Dynata', () => {
    expect(surveyEntryUrl('https://survey.example.com', 'abc')).toBe(
      'https://survey.example.com/s/abc',
    );
  });

  it('ignores trailing slashes in the base URL', () => {
    expect(surveyEntryUrl('https://survey.example.com//', 'abc')).toBe(
      'https://survey.example.com/s/abc',
    );
  });
});
