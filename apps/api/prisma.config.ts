import { defineConfig } from 'prisma/config';

// On the host, read DATABASE_URL from the repo-root .env. In Docker and CI it is already set,
// and loadEnvFile never overrides existing variables.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` and `validate` don't need a database, so the URL may be absent here.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
