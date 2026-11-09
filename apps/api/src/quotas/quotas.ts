import {
  conditionSchema,
  evaluateCondition,
  type AnswerValue,
  type ConditionContext,
} from '@survey-dynata/shared';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import type { OutcomeHook } from '../session/end-session.js';

// Quota engine (DSA-308). Cap cells close when full; minimum cells only count. A respondent who
// matches a full cap cell ends as over-quota. Counts increase only on complete, inside the
// transaction that ends the session, with the survey's quota rows locked.

interface Cell {
  id: string;
  kind: 'cap' | 'minimum';
  target: number;
  currentCount: number;
  conditions: unknown;
}

const matches = (cell: Cell, ctx: ConditionContext) =>
  evaluateCondition(conditionSchema.parse(cell.conditions), ctx);

function answersContext(
  answers: { value: unknown; question: { code: string } }[],
): ConditionContext {
  const byCode = new Map(
    answers.map((answer) => [answer.question.code, answer.value as AnswerValue]),
  );
  return { answer: (code) => byCode.get(code), assignment: () => undefined };
}

/** While answering: does the respondent already fall into a cap cell that is full? */
export async function inFullQuota(
  db: PrismaClient,
  surveyId: string,
  ctx: ConditionContext,
): Promise<boolean> {
  const cells = await db.quotaCell.findMany({ where: { surveyId, kind: 'cap' } });
  return cells.some((cell) => cell.currentCount >= cell.target && matches(cell, ctx));
}

/**
 * On complete: lock the survey's quota cells, turn the outcome into over-quota if a matching
 * cap cell is full, otherwise count the complete in every matching cell.
 */
export const applyQuotasOnComplete: OutcomeHook = async (tx, respondent, outcome) => {
  if (outcome !== 'complete') return outcome;

  // Lock in a fixed order so concurrent completes queue instead of deadlocking.
  const cells = await tx.$queryRaw<Cell[]>`
    SELECT id, kind::text AS kind, target, "currentCount", conditions
    FROM "QuotaCell" WHERE "surveyId" = ${respondent.surveyId}::uuid
    ORDER BY id FOR UPDATE`;
  if (cells.length === 0) return outcome;

  const ctx = answersContext(
    await tx.answer.findMany({
      where: { respondentId: respondent.id },
      select: { value: true, question: { select: { code: true } } },
    }),
  );
  const matching = cells.filter((cell) => matches(cell, ctx));
  if (matching.some((cell) => cell.kind === 'cap' && cell.currentCount >= cell.target)) {
    return 'overquota';
  }
  await tx.quotaCell.updateMany({
    where: { id: { in: matching.map((cell) => cell.id) } },
    data: { currentCount: { increment: 1 } },
  } satisfies Prisma.QuotaCellUpdateManyArgs);
  return outcome;
};
