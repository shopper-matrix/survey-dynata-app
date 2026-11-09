import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../providers/sample-provider.js';
import { DynataApiError, type DynataClient } from './client.js';
import { DYNATA_API_URL, type DynataConfig } from './config.js';
import { createDynataProvider } from './provider.js';

const links = {
  verification: 'success' as const,
  completeLink: 'https://d.example/end?rst=1',
  screenOutLink: 'https://d.example/end?rst=2',
  overQuotaLink: 'https://d.example/end?rst=3',
  invalidSignatureLink: 'https://d.example/end?rst=2&svFlag=1',
};
const config: DynataConfig = { mode: 'mock', keyId: 'k', secret: 's', apiUrl: DYNATA_API_URL };
const make = (result: () => Promise<typeof links>, mode: DynataConfig['mode'] = 'mock') =>
  createDynataProvider({
    client: { buildAndValidate: result } satisfies DynataClient,
    config: { ...config, mode },
    appBaseUrl: 'http://localhost:5173',
  });

describe('Dynata sample provider', () => {
  it('reads psid as the respondent ID', () => {
    const provider = make(() => Promise.resolve(links));
    expect(provider.respondentId(new URL('https://x/s/1?project=1&psid=AB*1'))).toBe('AB*1');
    expect(provider.respondentId(new URL('https://x/s/1?psid=%20'))).toBeNull();
    expect(provider.respondentId(new URL('https://x/s/1?project=1'))).toBeNull();
  });

  it('maps Dynata links to outcomes; quality uses the screen-out link for now', async () => {
    const provider = make(() => Promise.resolve(links));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).resolves.toEqual({
      verified: true,
      endLinks: {
        complete: links.completeLink,
        screenout: links.screenOutLink,
        overquota: links.overQuotaLink,
        quality: links.screenOutLink,
      },
      invalidLink: links.invalidSignatureLink,
    });
  });

  it('turns API errors into ProviderUnavailableError', async () => {
    const provider = make(() => Promise.reject(new DynataApiError('down')));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });
});
