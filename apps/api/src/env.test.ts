import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

describe('loadEnv', () => {
  it('applies defaults when only required variables are set', () => {
    expect(loadEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL: is required/);
  });

  it('treats an empty value as missing', () => {
    expect(() => loadEnv({ DATABASE_URL: '' })).toThrow(/DATABASE_URL: is required/);
  });

  it('reports every problem at once', () => {
    try {
      loadEnv({ DATABASE_URL: 'mysql://x', PORT: 'abc', NODE_ENV: 'staging' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const { problems } = error as EnvValidationError;
      expect(problems).toHaveLength(3);
      expect(problems.join('\n')).toMatch(/DATABASE_URL/);
      expect(problems.join('\n')).toMatch(/PORT/);
      expect(problems.join('\n')).toMatch(/NODE_ENV/);
    }
  });
});
