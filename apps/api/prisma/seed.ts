// `pnpm db:seed` (runs via `prisma db seed`): creates or replaces the demo survey.
import { createDb } from '../src/db.js';
import { loadEnv } from '../src/env.js';
import { seedDemo } from '../src/seed/seed-demo.js';

const env = loadEnv();
if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

const db = createDb(env.DATABASE_URL);
try {
  const summary = await seedDemo(db);
  console.log(
    `Demo survey seeded: ${String(summary.questions)} questions, ` +
      `${String(summary.respondents)} respondents, ${String(summary.answers)} answers.`,
  );
} finally {
  await db.$disconnect();
}
