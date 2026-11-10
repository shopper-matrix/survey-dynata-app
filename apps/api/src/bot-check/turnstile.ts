import { z } from 'zod';

// Cloudflare Turnstile (DSA-402): the welcome screen shows the widget, the API verifies its
// token before the first question. Without keys the check is off (local development).
// Cloudflare's documented test keys: site key 1x00000000000000000000AA with secret
// 1x0000000000000000000000000000000AA always pass.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

export interface BotCheck {
  /** Public site key for the browser widget, or null when the check is off. */
  siteKey: string | null;
  verify(token: string | undefined, remoteIp: string): Promise<boolean>;
}

const responseSchema = z.object({ success: z.boolean() });

export function createTurnstile(options: {
  siteKey?: string | undefined;
  secretKey?: string | undefined;
  fetch?: typeof fetch;
}): BotCheck {
  const { siteKey, secretKey } = options;
  if (!siteKey || !secretKey) {
    return { siteKey: null, verify: () => Promise.resolve(true) };
  }
  const fetchImpl = options.fetch ?? fetch;
  return {
    siteKey,
    async verify(token, remoteIp) {
      if (!token) return false;
      try {
        const response = await fetchImpl(VERIFY_URL, {
          method: 'POST',
          body: new URLSearchParams({ secret: secretKey, response: token, remoteip: remoteIp }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const parsed = responseSchema.safeParse(await response.json());
        return parsed.success && parsed.data.success;
      } catch {
        return false; // Fail closed: no verification, no survey.
      }
    },
  };
}
