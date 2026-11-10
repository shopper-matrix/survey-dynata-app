// Integration test: runs the demo seed against a real database (see respondents.db.test.ts).
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { DEMO_DYNATA_PROJECT_ID, DEMO_SURVEY_ID } from './demo-survey.js';
import { seedDemo } from './seed-demo.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);

afterAll(async () => {
  await db.$disconnect();
});

describe('seedDemo', () => {
  it('creates the demo survey and can be run again without duplicates', async () => {
    const first = await seedDemo(db);
    const second = await seedDemo(db);
    expect(second).toEqual(first);

    const where = { surveyId: DEMO_SURVEY_ID };
    expect(await db.survey.count({ where: { id: DEMO_SURVEY_ID } })).toBe(1);
    expect(await db.respondent.count({ where })).toBe(50);
    expect(await db.question.count({ where })).toBe(first.questions);
    expect(await db.answer.count({ where: { respondent: where } })).toBe(first.answers);
    expect(await db.screeningRule.count({ where: { question: where } })).toBe(2);

    const quotas = await db.quotaCell.findMany({ where, orderBy: { name: 'asc' } });
    expect(quotas.map((q) => [q.name, q.currentCount])).toEqual([
      ['Men', 12],
      ['Women', 13],
    ]);
    expect(
      await db.dynataSurveySettings.findUnique({ where: { surveyId: DEMO_SURVEY_ID } }),
    ).toMatchObject({
      projectId: DEMO_DYNATA_PROJECT_ID,
    });
  });
});
