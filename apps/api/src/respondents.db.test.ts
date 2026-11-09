// Integration test against a real database: run with `pnpm --filter @survey-dynata/api test:db`
// after `pnpm db:deploy`. Uses DATABASE_URL from the environment or the repo-root .env.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './db.js';
import { loadEnv } from './env.js';

try {
  process.loadEnvFile(new URL('../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);
let surveyId: string;

beforeAll(async () => {
  const survey = await db.survey.create({
    data: { title: `db test ${randomUUID()}`, targetCompletes: 10 },
  });
  surveyId = survey.id;
});

afterAll(async () => {
  // Cascades to respondents.
  await db.survey.delete({ where: { id: surveyId } });
  await db.$disconnect();
});

describe('Respondent uniqueness', () => {
  it('rejects the same panel respondent ID twice in one survey', async () => {
    await db.respondent.create({ data: { surveyId, panelRespondentId: 'TEST-0001' } });

    await expect(
      db.respondent.create({ data: { surveyId, panelRespondentId: 'TEST-0001' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same panel respondent ID in another survey', async () => {
    const other = await db.survey.create({ data: { title: 'other', targetCompletes: 1 } });
    try {
      await expect(
        db.respondent.create({ data: { surveyId: other.id, panelRespondentId: 'TEST-0001' } }),
      ).resolves.toMatchObject({ status: 'started', isTest: false });
    } finally {
      await db.survey.delete({ where: { id: other.id } });
    }
  });
});
