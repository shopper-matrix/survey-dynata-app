import { describe, expect, it } from 'vitest';
import { getHealth } from './health.js';

describe('getHealth', () => {
  it('reports ok', () => {
    expect(getHealth()).toEqual({ service: 'Survey Dynata App API', status: 'ok' });
  });
});
