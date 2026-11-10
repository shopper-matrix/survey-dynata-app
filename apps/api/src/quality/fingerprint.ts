import { createHmac } from 'node:crypto';

// Salted hashes for duplicate checks (DSA-502). Raw IPs and device details are never stored:
// only an HMAC keyed with a server secret, so the hashes can't be reversed by guessing IPs.

export interface Fingerprint {
  ipHash: string;
  deviceHash: string;
}

type Headers = Record<string, string | string[] | undefined>;

const header = (headers: Headers, name: string) => {
  const value = headers[name];
  return (Array.isArray(value) ? value.join(',') : value) ?? '';
};

/** Keyed with the server secret plus a label, so these hashes never equal any other HMAC. */
function hash(secret: string, kind: string, value: string): string {
  return createHmac('sha256', `${secret}:fingerprint:${kind}`).update(value).digest('hex');
}

/**
 * The device signature is what the browser sends with every request (user agent, languages,
 * client hints): weak alone, but together with the same IP a strong sign of a repeat entrant.
 */
export function fingerprint(secret: string, ip: string, headers: Headers): Fingerprint {
  const device = ['user-agent', 'accept-language', 'sec-ch-ua', 'sec-ch-ua-platform']
    .map((name) => header(headers, name))
    .join('\n');
  return { ipHash: hash(secret, 'ip', ip), deviceHash: hash(secret, 'device', device) };
}

/** Flags for a new entrant whose fingerprint matches earlier respondents of the survey. */
export function duplicateFlags(matches: { sameIp: number; sameIpAndDevice: number }): string[] {
  return [
    ...(matches.sameIp > 0 ? ['duplicate_ip'] : []),
    ...(matches.sameIpAndDevice > 0 ? ['duplicate_device'] : []),
  ];
}
