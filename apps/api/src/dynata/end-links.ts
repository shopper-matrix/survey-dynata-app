import type { EndOutcome } from '../providers/sample-provider.js';
import type { DynataConfig } from './config.js';
import { signUrl } from './signature.js';

// "Dynata Secured Links (End)" (DSA-304): we build each respondent's end link ourselves and sign
// it with the client secret: <end page>?rst=…&psid=…&_k=…&_s=…, `_s` last, a new signature per
// respondent and outcome (docs/dynata-integration.md).

function resultCode(outcome: EndOutcome, qualityFlag: string): string {
  switch (outcome) {
    case 'complete':
      return 'rst=1';
    case 'screenout':
      return 'rst=2';
    case 'overquota':
      return 'rst=3';
    case 'quality':
      return `rst=2&qFlag=${encodeURIComponent(qualityFlag)}`;
  }
}

/**
 * The signed end link for one respondent and outcome. `endPage` is Dynata's end page in live
 * mode and the local mock page in mock mode.
 */
export function endLinkFor(
  config: Pick<DynataConfig, 'keyId' | 'secret' | 'qualityFlag'>,
  endPage: string,
  psid: string,
  outcome: EndOutcome,
): string {
  const query = `${resultCode(outcome, config.qualityFlag)}&psid=${encodeURIComponent(psid)}&_k=${encodeURIComponent(config.keyId)}`;
  return signUrl(`${endPage}?${query}`, config.secret);
}
