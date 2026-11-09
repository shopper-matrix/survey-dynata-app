import { z } from 'zod';
import { checkDynataEnv, dynataEnvShape } from './dynata/config.js';

/**
 * Every environment variable the API reads. Documented in /.env.example.
 * Add new settings here (never read process.env elsewhere) so they are validated at startup.
 * Provider-specific variables are defined in their module (e.g. dynata/config.ts).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number({ error: 'must be a number' }).int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string({ error: 'is required' })
      .regex(/^postgres(ql)?:\/\/.+/, 'must be a postgres:// connection string'),
    /** Public address of the API, used in links given to sample providers. */
    APP_BASE_URL: z.url({ error: 'is required and must be a URL' }),
    /** Signs the respondent session cookie. */
    SESSION_SECRET: z
      .string({ error: 'is required' })
      .min(32, 'must be at least 32 characters (use a long random value)'),
    /** Admin sessions end after this many minutes without activity. */
    ADMIN_SESSION_IDLE_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .default(30),
    ...dynataEnvShape,
  })
  .superRefine(checkDynataEnv);

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Parses and validates the environment; throws EnvValidationError listing every problem. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // Treat empty strings (e.g. `DATABASE_URL=` in .env) the same as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
