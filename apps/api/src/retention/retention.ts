import type { PrismaClient } from '@survey-dynata/shared/db/client';

// Data retention (DSA-504): respondents and their answers are deleted once the survey's
// retention period has passed since they finished (or started, if they never finished).
// Every run is logged with counts only, never with respondent IDs or answers.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  respondentsDeleted: number;
  answersDeleted: number;
  perSurvey: Record<string, number>;
}

export async function runRetention(db: PrismaClient, now = new Date()): Promise<RetentionResult> {
  const surveys = await db.survey.findMany({
    where: { retentionDays: { not: null } },
    select: { id: true, retentionDays: true },
  });

  const result: RetentionResult = { respondentsDeleted: 0, answersDeleted: 0, perSurvey: {} };
  for (const survey of surveys) {
    const cutoff = new Date(now.getTime() - (survey.retentionDays ?? 0) * DAY_MS);
    const expired = {
      surveyId: survey.id,
      OR: [{ endedAt: { lt: cutoff } }, { endedAt: null, startedAt: { lt: cutoff } }],
    };
    const [answers, respondents] = await db.$transaction([
      db.answer.deleteMany({ where: { respondent: expired } }),
      // Redirect logs go with the respondent (cascade).
      db.respondent.deleteMany({ where: expired }),
    ]);
    if (respondents.count === 0) continue;
    result.respondentsDeleted += respondents.count;
    result.answersDeleted += answers.count;
    result.perSurvey[survey.id] = respondents.count;
  }

  await db.retentionRun.create({ data: { ...result, ranAt: now } });
  return result;
}
