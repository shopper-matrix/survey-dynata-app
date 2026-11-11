import { describe, expect, it } from 'vitest';
import { loadEnv } from '../env.js';
import { DYNATA_API_URL, DYNATA_END_URL, dynataConfig, MOCK_CREDENTIALS } from './config.js';

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
      security: 'start-end',
      endUrl: DYNATA_END_URL,
      qualityFlag: '2',
    });
  });

  it('uses the client key ID and secret from the environment', () => {
    const env = loadEnv({
      ...required,
      DYNATA_MODE: 'live',
      DYNATA_SECURITY: 'end',
      DYNATA_KEY_ID: 'client-key',
      DYNATA_SECRET: 'client-secret',
      DYNATA_END_URL: 'https://end.example/projects/end',
      DYNATA_QUALITY_FLAG: '1',
    });
    expect(dynataConfig(env)).toMatchObject({
      mode: 'live',
      security: 'end',
      keyId: 'client-key',
      secret: 'client-secret',
      endUrl: 'https://end.example/projects/end',
      qualityFlag: '1',
    });
  });

  it('requires both credentials in live mode', () => {
    expect(() => loadEnv({ ...required, DYNATA_MODE: 'live', DYNATA_SECURITY: 'end' })).toThrow(
      /DYNATA_KEY_ID: is required when DYNATA_MODE=live[\s\S]*DYNATA_SECRET/,
    );
  });

  it('refuses live Start-End mode until its end links are stored per respondent', () => {
    expect(() =>
      loadEnv({ ...required, DYNATA_MODE: 'live', DYNATA_KEY_ID: 'k', DYNATA_SECRET: 's' }),
    ).toThrow(/DYNATA_SECURITY: start-end is not supported in live mode yet/);
  });

  it('rejects a quality flag that is not a plain value', () => {
    expect(() => loadEnv({ ...required, DYNATA_QUALITY_FLAG: '2&rst=1' })).toThrow(
      /DYNATA_QUALITY_FLAG/,
    );
  });
});
