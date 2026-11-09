import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pg from 'pg';
import { getHealth } from './health.js';

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new pg.Pool({ connectionString: databaseUrl });
// An idle client losing its connection must not crash the process.
pool.on('error', (error) => {
  console.error('Postgres pool error:', error.message);
});

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'GET' && req.url === '/health') {
    const health = await getHealth(async () => {
      await pool.query('SELECT 1');
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

server.listen(port, () => {
  console.log(`API listening on http://localhost:${String(port)}`);
});

function shutdown(): void {
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
