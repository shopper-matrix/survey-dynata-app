import {
  ProviderUnavailableError,
  type EntryVerification,
  type SampleProvider,
} from '../providers/sample-provider.js';
import { DynataApiError, type DynataClient, type DynataLinks } from './client.js';
import type { DynataConfig } from './config.js';
import { mockEndLink } from './mock-links.js';
import { registerMockEndPage } from './mock-end-page.js';

/**
 * Dynata's API returns no link for quality terminations (open question, see
 * docs/dynata-integration.md). Until Dynata answers, quality cases use the screen-out link.
 */
const QUALITY_LINK = 'screenOutLink' satisfies keyof DynataLinks;

interface DynataProviderOptions {
  client: DynataClient;
  config: DynataConfig;
  appBaseUrl: string;
}

export function createDynataProvider({
  client,
  config,
  appBaseUrl,
}: DynataProviderOptions): SampleProvider {
  const mock = config.mode === 'mock';

  return {
    respondentId(entryUrl) {
      const psid = entryUrl.searchParams.get('psid')?.trim() ?? '';
      return psid.length > 0 ? psid : null;
    },

    async verifyEntry(entryUrl): Promise<EntryVerification> {
      let links: DynataLinks;
      try {
        links = await client.buildAndValidate(entryUrl);
      } catch (error) {
        if (error instanceof DynataApiError) {
          throw new ProviderUnavailableError(error.message, { cause: error });
        }
        throw error;
      }
      return {
        verified: links.verification === 'success',
        endLinks: {
          complete: links.completeLink,
          screenout: links.screenOutLink,
          overquota: links.overQuotaLink,
          quality: links[QUALITY_LINK],
        },
        invalidLink: links.invalidSignatureLink,
      };
    },

    endLink(respondent, outcome) {
      if (!mock) {
        // Live links depend on Dynata's security mode, decided with the parked DSA-303/304.
        throw new Error('Live Dynata end links are not implemented yet (DSA-304 is parked).');
      }
      return mockEndLink(appBaseUrl, config.secret, respondent.panelRespondentId, outcome);
    },

    ...(mock
      ? {
          registerRoutes: (app) => {
            registerMockEndPage(app, { appBaseUrl, secret: config.secret });
          },
        }
      : {}),
  };
}
