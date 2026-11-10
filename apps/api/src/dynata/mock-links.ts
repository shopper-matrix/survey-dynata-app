import type { EndOutcome } from '../providers/sample-provider.js';
import { signUrl } from './signature.js';

// Mock mode: end links point at the local /mock-dynata/end page instead of
// dkr1.ssisurveys.com and use Dynata's result codes, signed with the mock secret.

/** Dynata result codes (docs/dynata-integration.md). The quality flag value is still open. */
export const RESULT_CODES: Record<EndOutcome | 'invalid', string> = {
  complete: 'rst=1',
  screenout: 'rst=2',
  overquota: 'rst=3',
  quality: 'rst=2&qflag=1',
  invalid: 'rst=2&svFlag=1',
};

export function mockEndLink(
  appBaseUrl: string,
  secret: string,
  psid: string,
  outcome: keyof typeof RESULT_CODES,
): string {
  const base = appBaseUrl.replace(/\/+$/, '');
  return signUrl(
    `${base}/mock-dynata/end?${RESULT_CODES[outcome]}&psid=${encodeURIComponent(psid)}`,
    secret,
  );
}
