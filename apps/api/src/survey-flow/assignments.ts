import { randomInt } from 'node:crypto';
import { chosenIds } from '@survey-dynata/shared';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import { STRATA_KEY, type FlowAssignment, type RespondentState } from './types.js';

// Balanced random assignment to test groups (split cells): each respondent gets the value(s)
// used least so far among respondents of the same stratum; ties are broken randomly.
// Balance is approximate under heavy concurrency, which is fine for split cells.

/** Stratum key from the answers to `stratifyBy`, e.g. "1" for H1 = "ja, regelmäßig". */
export function stratumOf(assignment: FlowAssignment, state: RespondentState): string {
  return assignment.stratifyBy
    .map((code) => {
      const answer = state.answers.get(code);
      const ids = chosenIds(answer);
      if (ids.length > 0) return ids.join('+');
      return answer && typeof answer.value === 'number' ? String(answer.value) : '-';
    })
    .join('|');
}

async function usage(
  db: PrismaClient,
  surveyId: string,
  assignment: FlowAssignment,
  stratum: string,
  value: string,
): Promise<number> {
  const inStratum: Prisma.RespondentWhereInput = {
    assignments: { path: [STRATA_KEY, assignment.name], equals: stratum },
  };
  const hasValue: Prisma.RespondentWhereInput =
    assignment.pick > 1
      ? { assignments: { path: [assignment.name], array_contains: [value] } }
      : { assignments: { path: [assignment.name], equals: value } };
  return db.respondent.count({ where: { surveyId, AND: [inStratum, hasValue] } });
}

/** Picks the value(s) for one test group and stores them on the respondent. */
export async function assign(
  db: PrismaClient,
  surveyId: string,
  assignment: FlowAssignment,
  state: RespondentState,
): Promise<void> {
  const stratum = stratumOf(assignment, state);
  const counts = await Promise.all(
    assignment.values.map(async (value) => ({
      value,
      count: await usage(db, surveyId, assignment, stratum, value),
      tieBreak: randomInt(1_000_000),
    })),
  );
  const chosen = counts
    .sort((a, b) => a.count - b.count || a.tieBreak - b.tieBreak)
    .slice(0, assignment.pick)
    .map((entry) => entry.value);

  const strata = (state.assignments[STRATA_KEY] ?? {}) as Record<string, string>;
  state.assignments[assignment.name] = assignment.pick > 1 ? chosen : chosen[0];
  state.assignments[STRATA_KEY] = { ...strata, [assignment.name]: stratum };
  await db.respondent.update({
    where: { id: state.respondentId },
    data: { assignments: state.assignments as Prisma.InputJsonValue },
  });
}
