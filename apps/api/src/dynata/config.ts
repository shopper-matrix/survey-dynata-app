import { z } from 'zod';

// Dynata settings from the environment. Key ID and secret are issued once per client by
// Dynata; they are only required in live mode. See docs/dynata-integration.md.

export const DYNATA_API_URL = 'https://passphrase.dynata.com/v1/links/buildAndValidate';

/** Used only in mock mode, so local development works without Dynata credentials. */
export const MOCK_CREDENTIALS = { keyId: 'mock-key', secret: 'mock-secret' } as const;

export const dynataEnvShape = {
  /** mock: verify and sign locally, end links point at local pages. live: Dynata's API. */
  DYNATA_MODE: z.enum(['mock', 'live']).default('mock'),
  DYNATA_KEY_ID: z.string().optional(),
  DYNATA_SECRET: z.string().optional(),
  DYNATA_API_URL: z.url().default(DYNATA_API_URL),
};

type DynataEnv = z.infer<z.ZodObject<typeof dynataEnvShape>>;

/** Adds an issue for every credential missing in live mode. */
export function checkDynataEnv(env: DynataEnv, ctx: z.RefinementCtx): void {
  if (env.DYNATA_MODE !== 'live') return;
  for (const key of ['DYNATA_KEY_ID', 'DYNATA_SECRET'] as const) {
    if (!env[key])
      ctx.addIssue({ code: 'custom', path: [key], message: 'is required when DYNATA_MODE=live' });
  }
}

export interface DynataConfig {
  mode: 'mock' | 'live';
  keyId: string;
  secret: string;
  apiUrl: string;
}

export function dynataConfig(env: DynataEnv): DynataConfig {
  return {
    mode: env.DYNATA_MODE,
    keyId: env.DYNATA_KEY_ID ?? MOCK_CREDENTIALS.keyId,
    secret: env.DYNATA_SECRET ?? MOCK_CREDENTIALS.secret,
    apiUrl: env.DYNATA_API_URL,
  };
}
