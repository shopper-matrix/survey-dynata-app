import {
  ProviderUnavailableError,
  type EndOutcome,
  type EntryVerification,
  type SampleProvider,
} from '../providers/sample-provider.js';
import { DynataApiError, type DynataClient, type DynataLinks } from './client.js';
import { registerDynataAdminRoutes } from './admin-routes.js';
import type { DynataConfig } from './config.js';
import { endLinkFor } from './end-links.js';
import { mockEndLink } from './mock-links.js';
import { MOCK_END_PATH, registerMockEndPage } from './mock-end-page.js';
import { signUrl } from './signature.js';

/**
 * Start-End mode: Dynata's API returns no link for quality terminations, so quality cases use
 * the screen-out link there (docs/dynata-integration.md).
 */
const QUALITY_LINK = 'screenOutLink' satisfies keyof DynataLinks;

interface DynataProviderOptions {
  client: DynataClient;
  config: DynataConfig;
  appBaseUrl: string;
}

const OUTCOMES: EndOutcome[] = ['complete', 'screenout', 'overquota', 'quality'];

export function createDynataProvider({
  client,
  config,
  appBaseUrl,
}: DynataProviderOptions): SampleProvider {
  const mock = config.mode === 'mock';
  const endMode = config.security === 'end';
  const base = appBaseUrl.replace(/\/+$/, '');
  const endPage = mock ? `${base}${MOCK_END_PATH}` : config.endUrl;

  const endLink = (psid: string, outcome: EndOutcome) =>
    endMode
      ? endLinkFor(config, endPage, psid, outcome)
      : mockEndLink(appBaseUrl, config.secret, psid, outcome);

  const psidOf = (entryUrl: string) => new URL(entryUrl).searchParams.get('psid')?.trim() ?? '';

  return {
    respondentId(entryUrl) {
      const psid = entryUrl.searchParams.get('psid')?.trim() ?? '';
      return psid.length > 0 ? psid : null;
    },

    async verifyEntry(entryUrl): Promise<EntryVerification> {
      if (endMode) {
        // End mode: Dynata does not sign entry links; the signed end link is the proof.
        const psid = psidOf(entryUrl);
        const endLinks = Object.fromEntries(
          OUTCOMES.map((outcome) => [outcome, endLink(psid, outcome)]),
        ) as Record<EndOutcome, string>;
        return { verified: true, endLinks, invalidLink: endLinks.screenout };
      }

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
      if (!mock && !endMode) {
        // Ruled out at startup (config.ts): the API's links are not stored per respondent yet.
        throw new Error('Live Start-End end links are not implemented yet (DSA-304).');
      }
      return endLink(respondent.panelRespondentId, outcome);
    },

    registerAdminRoutes(app, options) {
      registerDynataAdminRoutes(app, options, config);
    },

    testEntryUrl(surveyEntryUrl, panelRespondentId) {
      if (endMode) {
        return `${surveyEntryUrl}?${new URLSearchParams({ psid: panelRespondentId }).toString()}`;
      }
      const query = new URLSearchParams({ psid: panelRespondentId, _k: config.keyId });
      return signUrl(`${surveyEntryUrl}?${query.toString()}`, config.secret);
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
