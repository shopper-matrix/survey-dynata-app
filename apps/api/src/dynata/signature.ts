import { createHmac, timingSafeEqual } from 'node:crypto';

// Dynata's link signature: HMAC-SHA256 with the client secret over the URL's path and query
// up to (excluding) the `_s` parameter, hex-encoded and appended as `&_s=<signature>`.
// Reproduces the example in Dynata's "Signed URL Start-End API" document (see tests).

const SIGNATURE_PARAM = '_s';

/** Path + query of a URL exactly as written (no re-encoding), without the `_s` parameter. */
function signedPart(url: string): string {
  const rest = url.replace(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i, '');
  const pathAndQuery = rest.startsWith('/') ? rest : `/${rest}`;
  const signatureAt = pathAndQuery.search(/[?&]_s=/);
  return signatureAt === -1 ? pathAndQuery : pathAndQuery.slice(0, signatureAt);
}

export function computeSignature(url: string, secret: string): string {
  return createHmac('sha256', secret).update(signedPart(url)).digest('hex');
}

/** Appends the signature to a URL that has a query string. */
export function signUrl(url: string, secret: string): string {
  return `${url}&${SIGNATURE_PARAM}=${computeSignature(url, secret)}`;
}

/** True when the URL carries a valid signature for this secret (constant-time compare). */
export function hasValidSignature(url: string, secret: string): boolean {
  const given = new URL(url).searchParams.get(SIGNATURE_PARAM);
  if (!given || !/^[0-9a-f]{64}$/i.test(given)) return false;
  return timingSafeEqual(
    Buffer.from(given.toLowerCase(), 'hex'),
    Buffer.from(computeSignature(url, secret), 'hex'),
  );
}
