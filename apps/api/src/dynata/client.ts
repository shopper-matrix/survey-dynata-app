import { z } from 'zod';
import type { DynataConfig } from './config.js';
import { hasValidSignature, signUrl } from './signature.js';

// One call per entering respondent: verify the signed entry link and get the four signed end
// links for this respondent. Live mode uses Dynata's buildAndValidate API; mock mode does the
// same locally and points the end links at local pages.

const linksSchema = z.object({
  verification: z.enum(['success', 'failure']),
  completeLink: z.url(),
  screenOutLink: z.url(),
  overQuotaLink: z.url(),
  /** Use instead of the others when verification failed. */
  invalidSignatureLink: z.url(),
});

export type DynataLinks = z.infer<typeof linksSchema>;

export interface DynataClient {
  buildAndValidate(entryUrl: string): Promise<DynataLinks>;
}

export class DynataApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DynataApiError';
  }
}

const REQUEST_TIMEOUT_MS = 5000;

/** End-link result codes (`rst`) used by Dynata. */
const RST = { complete: '1', screenOut: '2', overQuota: '3' } as const;

export function createDynataClient(
  config: DynataConfig,
  options: { appBaseUrl: string; fetch?: typeof fetch },
): DynataClient {
  return config.mode === 'live'
    ? liveClient(config, options.fetch ?? fetch)
    : mockClient(config, options.appBaseUrl);
}

function liveClient(config: DynataConfig, fetchImpl: typeof fetch): DynataClient {
  return {
    async buildAndValidate(entryUrl) {
      let response: Response;
      try {
        response = await fetchImpl(config.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyId: config.keyId, secret: config.secret, url: entryUrl }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        throw new DynataApiError('Dynata API unreachable', { cause: error });
      }
      if (!response.ok) {
        throw new DynataApiError(`Dynata API answered HTTP ${String(response.status)}`);
      }
      const parsed = linksSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new DynataApiError('Unexpected Dynata API response', { cause: parsed.error });
      }
      return parsed.data;
    },
  };
}

function mockClient(config: DynataConfig, appBaseUrl: string): DynataClient {
  return {
    buildAndValidate(entryUrl) {
      const params = new URL(entryUrl).searchParams;
      const verified =
        params.get('_k') === config.keyId && hasValidSignature(entryUrl, config.secret);
      const endLink = (rst: string, extra = '') => {
        const query = new URLSearchParams({
          project: params.get('project') ?? '',
          psid: params.get('psid') ?? '',
        });
        return signUrl(
          `${appBaseUrl}/mock-dynata/end?${query.toString()}&rst=${rst}${extra}`,
          config.secret,
        );
      };
      return Promise.resolve({
        verification: verified ? 'success' : 'failure',
        completeLink: endLink(RST.complete),
        screenOutLink: endLink(RST.screenOut),
        overQuotaLink: endLink(RST.overQuota),
        invalidSignatureLink: endLink(RST.screenOut, '&svFlag=1'),
      });
    },
  };
}
