import { buildApp } from './app.js';
import { createDb } from './db.js';
import { createDynataClient } from './dynata/client.js';
import { dynataConfig } from './dynata/config.js';
import { createDynataProvider } from './dynata/provider.js';
import { EnvValidationError, loadEnv, type Env } from './env.js';

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
const provider = createDynataProvider(createDynataClient(dynata, { appBaseUrl: env.APP_BASE_URL }));
const app = await buildApp({ db, env, provider, logger: true });

await app.listen({ host: '0.0.0.0', port: env.PORT });
app.log.info(`Environment ${env.NODE_ENV}, Dynata ${dynata.mode} mode`);

async function shutdown(): Promise<void> {
  await app.close();
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
