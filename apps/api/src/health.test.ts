import { describe, expect, it } from 'vitest';
import { getHealth } from './health.js';

describe('getHealth', () => {
  it('reports ok when the database answers', async () => {
    await expect(getHealth(() => Promise.resolve())).resolves.toEqual({
      service: 'Survey Dynata App API',
      status: 'ok',
      database: 'ok',
    });
  });

  it('reports degraded when the database is unreachable', async () => {
    await expect(getHealth(() => Promise.reject(new Error('down')))).resolves.toMatchObject({
      status: 'degraded',
      database: 'unreachable',
    });
  });
});
