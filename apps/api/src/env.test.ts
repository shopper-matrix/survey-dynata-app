import { describe, expect, it } from 'vitest';
import { DYNATA_API_URL } from './dynata/config.js';
import { EnvValidationError, loadEnv } from './env.js';

const required = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  APP_BASE_URL: 'http://localhost:3000',
};

describe('loadEnv', () => {
  it('applies defaults when only required variables are set', () => {
    expect(loadEnv(required)).toEqual({
      ...required,
      NODE_ENV: 'development',
      PORT: 3000,
      DYNATA_MODE: 'mock',
      DYNATA_API_URL,
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadEnv({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({ APP_BASE_URL: required.APP_BASE_URL })).toThrow(
      /DATABASE_URL: is required/,
    );
  });

  it('treats an empty value as missing', () => {
    expect(() => loadEnv({ ...required, DATABASE_URL: '' })).toThrow(/DATABASE_URL: is required/);
  });

  it('reports every problem at once', () => {
    try {
      loadEnv({ DATABASE_URL: 'mysql://x', PORT: 'abc', NODE_ENV: 'staging' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const { problems } = error as EnvValidationError;
      expect(problems).toHaveLength(4);
      for (const name of ['DATABASE_URL', 'PORT', 'NODE_ENV', 'APP_BASE_URL']) {
        expect(problems.join('\n')).toContain(name);
      }
    }
  });

  it('requires Dynata credentials in live mode only', () => {
    expect(() => loadEnv({ ...required, DYNATA_MODE: 'live' })).toThrow(
      /DYNATA_KEY_ID: is required when DYNATA_MODE=live[\s\S]*DYNATA_SECRET/,
    );
    expect(
      loadEnv({ ...required, DYNATA_MODE: 'live', DYNATA_KEY_ID: '1', DYNATA_SECRET: 's' })
        .DYNATA_MODE,
    ).toBe('live');
  });
});
