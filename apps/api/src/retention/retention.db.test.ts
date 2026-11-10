// Integration test: the retention job deletes expired respondents and logs counts only.
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { runRetention } from './retention.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);
const NOW = new Date('2027-06-01T00:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const surveyIds: string[] = [];
const runIds: string[] = [];

async function surveyWith(retentionDays: number | null) {
  const survey = await db.survey.create({
    data: {
      title: 'Retention',
      targetCompletes: 1,
      retentionDays,
      blocks: { create: { code: 'A', title: 'A', position: 0 } },
    },
    include: { blocks: true },
  });
  surveyIds.push(survey.id);
  const block = survey.blocks[0];
  const question = await db.question.create({
    data: {
      surveyId: survey.id,
      blockId: block?.id ?? '',
      code: 'Q1',
      position: 0,
      type: 'open_text',
      text: 'Q',
    },
  });
  const respondent = async (id: string, startedAt: Date, endedAt: Date | null) => {
    const created = await db.respondent.create({
      data: { surveyId: survey.id, panelRespondentId: id, startedAt, endedAt },
    });
    await db.answer.create({
      data: { respondentId: created.id, questionId: question.id, value: { text: 'x' } },
    });
    await db.redirectLog.create({
      data: { respondentId: created.id, outcome: 'complete', url: 'https://end.example' },
    });
  };
  return { id: survey.id, respondent };
}

afterAll(async () => {
  await db.answer.deleteMany({ where: { respondent: { surveyId: { in: surveyIds } } } });
  await db.survey.deleteMany({ where: { id: { in: surveyIds } } });
  await db.retentionRun.deleteMany({ where: { id: { in: runIds } } });
  await db.$disconnect();
});

describe('retention job (DSA-504)', () => {
  it('deletes respondents past the period with their answers and logs counts only', async () => {
    const kept = await surveyWith(null);
    await kept.respondent('KEEP-OLD', daysAgo(900), daysAgo(899));
    const survey = await surveyWith(365);
    await survey.respondent('OLD-DONE', daysAgo(400), daysAgo(399));
    await survey.respondent('OLD-DROPOUT', daysAgo(370), null);
    await survey.respondent('RECENT', daysAgo(400), daysAgo(10));

    // The test database is shared, so only this survey's figures are exact.
    const result = await runRetention(db, NOW);
    expect(result.perSurvey[survey.id]).toBe(2);
    expect(result.perSurvey[kept.id]).toBeUndefined();
    expect(result.respondentsDeleted).toBeGreaterThanOrEqual(2);

    const left = await db.respondent.findMany({
      where: { surveyId: { in: [kept.id, survey.id] } },
      select: { panelRespondentId: true },
      orderBy: { panelRespondentId: 'asc' },
    });
    expect(left.map((r) => r.panelRespondentId)).toEqual(['KEEP-OLD', 'RECENT']);
    expect(await db.answer.count({ where: { respondent: { surveyId: survey.id } } })).toBe(1);
    expect(await db.redirectLog.count({ where: { respondent: { surveyId: survey.id } } })).toBe(1);

    const run = await db.retentionRun.findFirstOrThrow({ where: { ranAt: NOW } });
    runIds.push(run.id);
    expect(JSON.stringify(run)).not.toMatch(/OLD-DONE|OLD-DROPOUT/);
  });

  it('logs a run even when nothing was due', async () => {
    const later = new Date(NOW.getTime() + 1000);
    expect(await runRetention(db, later)).toMatchObject({ respondentsDeleted: 0, perSurvey: {} });
    const run = await db.retentionRun.findFirstOrThrow({ where: { ranAt: later } });
    runIds.push(run.id);
  });
});
