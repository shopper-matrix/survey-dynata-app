import { describe, expect, it } from 'vitest';
import { loadEnv } from '../env.js';
import { DYNATA_API_URL, dynataConfig, MOCK_CREDENTIALS } from './config.js';

const required = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  APP_BASE_URL: 'http://localhost:5173',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('Dynata config', () => {
  it('uses the mock credentials when none are set (mock mode)', () => {
    expect(dynataConfig(loadEnv(required))).toEqual({
      mode: 'mock',
      ...MOCK_CREDENTIALS,
      apiUrl: DYNATA_API_URL,
    });
  });

  it('uses the client key ID and secret from the environment', () => {
    const env = loadEnv({
      ...required,
      DYNATA_MODE: 'live',
      DYNATA_KEY_ID: 'client-key',
      DYNATA_SECRET: 'client-secret',
    });
    expect(dynataConfig(env)).toMatchObject({
      mode: 'live',
      keyId: 'client-key',
      secret: 'client-secret',
    });
  });

  it('requires both credentials in live mode', () => {
    expect(() => loadEnv({ ...required, DYNATA_MODE: 'live' })).toThrow(
      /DYNATA_KEY_ID: is required when DYNATA_MODE=live[\s\S]*DYNATA_SECRET/,
    );
  });
});
