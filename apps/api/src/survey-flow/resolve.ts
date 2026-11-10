import { randomInt } from 'node:crypto';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import { createRandom } from '../lib/random.js';
import { assign } from './assignments.js';
import { rotateBlocks, walkSurvey, type FlowWalk } from './next-screen.js';
import { BLOCK_ORDER_KEY, type FlowSurvey, type RespondentState } from './types.js';

/**
 * Walks the survey for a respondent, persisting what the walk needs first: the block order on
 * the first visit and every test group reached on the way.
 */
export async function resolveWalk(
  db: PrismaClient,
  survey: FlowSurvey,
  state: RespondentState,
): Promise<FlowWalk> {
  if (!Array.isArray(state.assignments[BLOCK_ORDER_KEY])) {
    const rng = createRandom(randomInt(2 ** 31));
    state.assignments[BLOCK_ORDER_KEY] = rotateBlocks(survey.blocks, (items) => rng.shuffle(items));
    await db.respondent.update({
      where: { id: state.respondentId },
      data: { assignments: state.assignments as Prisma.InputJsonValue },
    });
  }

  for (;;) {
    const walk = walkSurvey(survey, state);
    if (walk.step.kind !== 'needs_assignment') return walk;
    const { name } = walk.step;
    const definition = survey.assignments.find((assignment) => assignment.name === name);
    if (!definition) throw new Error(`Survey ${survey.id} has no assignment named ${name}`);
    await assign(db, survey.id, definition, state);
  }
}
