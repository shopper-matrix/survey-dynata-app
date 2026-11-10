import { describe, expect, it } from 'vitest';
import { deviceTypeFromUserAgent } from './device.js';

describe('deviceTypeFromUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', 'phone'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140.0 Mobile Safari/537.36', 'phone'],
    ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'tablet'],
    ['Mozilla/5.0 (Linux; Android 15; SM-X710) Chrome/140.0 Safari/537.36', 'tablet'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0', 'desktop'],
    [undefined, 'desktop'],
  ])('%s → %s', (userAgent, expected) => {
    expect(deviceTypeFromUserAgent(userAgent)).toBe(expected);
  });
});
