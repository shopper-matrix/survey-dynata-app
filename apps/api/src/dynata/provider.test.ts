import { describe, expect, it } from 'vitest';
import { ProviderUnavailableError } from '../providers/sample-provider.js';
import { DynataApiError, type DynataClient } from './client.js';
import { createDynataProvider } from './provider.js';

const links = {
  verification: 'success' as const,
  completeLink: 'https://d.example/end?rst=1',
  screenOutLink: 'https://d.example/end?rst=2',
  overQuotaLink: 'https://d.example/end?rst=3',
  invalidSignatureLink: 'https://d.example/end?rst=2&svFlag=1',
};
const client = (result: () => Promise<typeof links>): DynataClient => ({
  buildAndValidate: result,
});

describe('Dynata sample provider', () => {
  it('reads psid as the respondent ID', () => {
    const provider = createDynataProvider(client(() => Promise.resolve(links)));
    expect(provider.respondentId(new URL('https://x/s/1?project=1&psid=AB*1'))).toBe('AB*1');
    expect(provider.respondentId(new URL('https://x/s/1?psid=%20'))).toBeNull();
    expect(provider.respondentId(new URL('https://x/s/1?project=1'))).toBeNull();
  });

  it('maps Dynata links to outcomes; quality uses the screen-out link for now', async () => {
    const provider = createDynataProvider(client(() => Promise.resolve(links)));
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
    const provider = createDynataProvider(client(() => Promise.reject(new DynataApiError('down'))));
    await expect(provider.verifyEntry('https://x/s/1?psid=1')).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });
});
