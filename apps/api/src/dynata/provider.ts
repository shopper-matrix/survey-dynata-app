import {
  ProviderUnavailableError,
  type EntryVerification,
  type SampleProvider,
} from '../providers/sample-provider.js';
import { DynataApiError, type DynataClient, type DynataLinks } from './client.js';

/**
 * Dynata's API returns no link for quality terminations (open question, see
 * docs/dynata-integration.md). Until Dynata answers, quality cases use the screen-out link.
 */
const QUALITY_LINK = 'screenOutLink' satisfies keyof DynataLinks;

export function createDynataProvider(client: DynataClient): SampleProvider {
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
  };
}
