import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createDb } from './db.js';
import { dynataConfig } from './dynata/config.js';
import { EnvValidationError, loadEnv, type Env } from './env.js';
import { getHealth } from './health.js';

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

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'GET' && req.url === '/health') {
    const health = await getHealth(async () => {
      await db.$queryRaw`SELECT 1`;
    });
    sendJson(res, health.status === 'ok' ? 200 : 503, health);
    return;
  }
  sendJson(res, 404, { error: 'Not found' });
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  });
});

server.listen(env.PORT, () => {
  console.log(
    `API listening on http://localhost:${String(env.PORT)} ` +
      `(${env.NODE_ENV}, Dynata ${dynataConfig(env).mode} mode)`,
  );
});

function shutdown(): void {
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
