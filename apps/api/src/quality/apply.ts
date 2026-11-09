import { attentionAnswerSchema, qualitySettingsSchema } from '@survey-dynata/shared';
import type { Prisma } from '@survey-dynata/shared/db/client';
import type { OutcomeHook } from '../session/end-session.js';
import { runQualityChecks } from './checks.js';

/** Median interview length (consent → end) of the survey's real completes. */
async function medianOfCompletes(tx: Prisma.TransactionClient, surveyId: string) {
  const [row] = await tx.$queryRaw<{ completes: bigint; median: number | null }[]>`
    SELECT count(*) AS completes,
           percentile_cont(0.5) WITHIN GROUP (
             ORDER BY extract(epoch FROM "endedAt" - coalesce("consentedAt", "startedAt"))
           ) AS median
    FROM "Respondent"
    WHERE "surveyId" = ${surveyId}::uuid AND status = 'complete' AND "isTest" = false
      AND "endedAt" IS NOT NULL`;
  return { completes: Number(row?.completes ?? 0), median: row?.median ?? null };
}

/**
 * On complete: runs the survey's quality checks, stores the flags on the respondent and turns
 * the outcome into `quality` when a check is set to terminate. Runs before the quota hook, so a
 * terminated respondent never takes a quota slot.
 */
export const applyQualityChecks: OutcomeHook = async (tx, respondent, outcome) => {
  if (outcome !== 'complete') return outcome;

  const { survey, startedAt, consentedAt, qualityFlags, answers } =
    await tx.respondent.findUniqueOrThrow({
      where: { id: respondent.id },
      select: {
        startedAt: true,
        consentedAt: true,
        qualityFlags: true,
        survey: { select: { qualitySettings: true, estimatedMinutes: true } },
        answers: {
          select: {
            value: true,
            question: { select: { code: true, type: true, attentionAnswer: true } },
          },
        },
      },
    });
  const settings = qualitySettingsSchema.parse(survey.qualitySettings);

  const { completes, median } = await medianOfCompletes(tx, respondent.surveyId);
  const estimated = survey.estimatedMinutes === null ? null : survey.estimatedMinutes * 60;
  const referenceSeconds =
    completes >= settings.speeder.minCompletesForMedian && median !== null ? median : estimated;

  const result = runQualityChecks({
    settings,
    interviewSeconds: (Date.now() - (consentedAt ?? startedAt).getTime()) / 1000,
    referenceSeconds,
    answers: answers.map(({ value, question }) => ({
      code: question.code,
      type: question.type,
      value,
      attentionAnswer:
        question.attentionAnswer === null
          ? null
          : attentionAnswerSchema.parse(question.attentionAnswer),
    })),
  });

  if (result.flags.length > 0) {
    const existing = Array.isArray(qualityFlags) ? qualityFlags.map(String) : [];
    await tx.respondent.update({
      where: { id: respondent.id },
      data: { qualityFlags: [...new Set([...existing, ...result.flags])] },
    });
  }
  return result.terminate ? 'quality' : outcome;
};
