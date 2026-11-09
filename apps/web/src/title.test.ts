import { describe, expect, it } from 'vitest';
import { pageTitle } from './title.js';

describe('pageTitle', () => {
  it('uses the app name alone by default', () => {
    expect(pageTitle()).toBe('Survey Dynata App');
  });

  it('prefixes the page name', () => {
    expect(pageTitle('Results')).toBe('Results · Survey Dynata App');
  });
});
