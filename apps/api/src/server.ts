import { buildApp } from './app.js';
import { createTurnstile } from './bot-check/turnstile.js';
import { createDb } from './db.js';
import { createDynataClient } from './dynata/client.js';
import { dynataConfig } from './dynata/config.js';
import { createDynataProvider } from './dynata/provider.js';
import { EnvValidationError, loadEnv, type Env } from './env.js';
import { scheduleRetention } from './retention/schedule.js';

let env: Env;
try {
  env = loadEnv();
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.error(`${error.message}\nSee .env.example for every variable and its meaning.`);
    process.exit(1);
  }
  throw error;
}

const db = createDb(env.DATABASE_URL);
const dynata = dynataConfig(env);
const provider = createDynataProvider({
  client: createDynataClient(dynata, { appBaseUrl: env.APP_BASE_URL }),
  config: dynata,
  appBaseUrl: env.APP_BASE_URL,
});
const botCheck = createTurnstile({
  siteKey: env.TURNSTILE_SITE_KEY,
  secretKey: env.TURNSTILE_SECRET_KEY,
});
const app = await buildApp({ db, env, provider, botCheck, logger: true });
if (!botCheck.siteKey)
  app.log.warn('Turnstile keys not set: bot check on the welcome screen is off');

await app.listen({ host: '0.0.0.0', port: env.PORT });
app.log.info(`Environment ${env.NODE_ENV}, Dynata ${dynata.mode} mode`);
const stopRetention = scheduleRetention(db, app.log);

async function shutdown(): Promise<void> {
  stopRetention();
  await app.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
