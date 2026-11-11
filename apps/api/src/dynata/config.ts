import { z } from 'zod';

// Dynata settings from the environment. Key ID and secret are issued once per client by
// Dynata; they are only required in live mode. See docs/dynata-integration.md.

export const DYNATA_API_URL = 'https://passphrase.dynata.com/v1/links/buildAndValidate';

/** Dynata's end page for "Secured Links (End)" projects (help article, DSA-304). */
export const DYNATA_END_URL = 'https://dkr1.ssisurveys.com/projects/end';

/** Used only in mock mode, so local development works without Dynata credentials. */
export const MOCK_CREDENTIALS = { keyId: 'mock-key', secret: 'mock-secret' } as const;

export const dynataEnvShape = {
  /** mock: links point at local test pages, nothing goes to Dynata. live: real Dynata links. */
  DYNATA_MODE: z.enum(['mock', 'live']).default('mock'),
  /**
   * The project's security mode in Dynata. end ("Dynata Secured Links (End)"): entry links
   * are not signed, we build and sign the end links. start-end ("Secured Links (Start-End)"):
   * entry links are signed and Dynata's buildAndValidate API returns the end links.
   */
  DYNATA_SECURITY: z.enum(['end', 'start-end']).default('start-end'),
  DYNATA_KEY_ID: z.string().optional(),
  DYNATA_SECRET: z.string().optional(),
  DYNATA_API_URL: z.url().default(DYNATA_API_URL),
  /** End mode: Dynata's end page, from the end links shown in the Dynata project. */
  DYNATA_END_URL: z.url().default(DYNATA_END_URL),
  /** End mode: value of `qFlag` on quality terminations (rst=2&qFlag=…), as in the project's links. */
  DYNATA_QUALITY_FLAG: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, 'must be a plain value such as 2')
    .default('1'),
};

type DynataEnv = z.infer<z.ZodObject<typeof dynataEnvShape>>;

/** Adds an issue for every credential missing in live mode. */
export function checkDynataEnv(env: DynataEnv, ctx: z.RefinementCtx): void {
  if (env.DYNATA_MODE !== 'live') return;
  for (const key of ['DYNATA_KEY_ID', 'DYNATA_SECRET'] as const) {
    if (!env[key])
      ctx.addIssue({ code: 'custom', path: [key], message: 'is required when DYNATA_MODE=live' });
  }
  if (env.DYNATA_SECURITY === 'start-end') {
    // The API's end links are not stored per respondent yet, so finishing would fail.
    ctx.addIssue({
      code: 'custom',
      path: ['DYNATA_SECURITY'],
      message: 'start-end is not supported in live mode yet; use end',
    });
  }
}

export type DynataSecurity = DynataEnv['DYNATA_SECURITY'];

export interface DynataConfig {
  mode: 'mock' | 'live';
  security: DynataSecurity;
  keyId: string;
  secret: string;
  apiUrl: string;
  endUrl: string;
  qualityFlag: string;
}

export function dynataConfig(env: DynataEnv): DynataConfig {
  return {
    mode: env.DYNATA_MODE,
    security: env.DYNATA_SECURITY,
    keyId: env.DYNATA_KEY_ID ?? MOCK_CREDENTIALS.keyId,
    secret: env.DYNATA_SECRET ?? MOCK_CREDENTIALS.secret,
    apiUrl: env.DYNATA_API_URL,
    endUrl: env.DYNATA_END_URL,
    qualityFlag: env.DYNATA_QUALITY_FLAG,
  };
}
