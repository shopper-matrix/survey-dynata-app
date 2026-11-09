import { evaluateCondition, referencedAssignments, type Condition } from '@survey-dynata/shared';
import { presentQuestion } from './present.js';
import {
  BLOCK_ORDER_KEY,
  type FlowBlock,
  type FlowQuestion,
  type FlowSurvey,
  type PresentedQuestion,
  type RespondentState,
} from './types.js';

// Decides what a respondent sees next. Pure: the caller loads the data and persists any
// assignment or block order this asks for.

export type FlowStep =
  | { kind: 'screen'; question: PresentedQuestion; progress: number }
  | { kind: 'done' }
  /** Assign this test group (balanced, see assignments.ts), then ask again. */
  | { kind: 'needs_assignment'; name: string };

export interface FlowWalk {
  step: FlowStep;
  /** Codes of answered questions that are still visible (their answers may be changed). */
  answeredVisible: Set<string>;
}

/** Blocks in the respondent's stored order; blocks missing from it keep their position. */
export function orderedBlocks(survey: FlowSurvey, state: RespondentState): FlowBlock[] {
  const stored = state.assignments[BLOCK_ORDER_KEY];
  const order = Array.isArray(stored) ? (stored as string[]) : [];
  const rank = (block: FlowBlock) => {
    const index = order.indexOf(block.code);
    return index === -1 ? order.length + survey.blocks.indexOf(block) : index;
  };
  return [...survey.blocks].sort((a, b) => rank(a) - rank(b));
}

/**
 * A block order for a new respondent: blocks sharing a rotation group are shuffled among the
 * positions they occupy; all other blocks stay in place.
 */
export function rotateBlocks(blocks: FlowBlock[], shuffle: <T>(items: T[]) => T[]): string[] {
  const order = blocks.map((block) => block.code);
  const groups = new Map<string, number[]>();
  blocks.forEach((block, index) => {
    if (block.rotationGroup)
      groups.set(block.rotationGroup, [...(groups.get(block.rotationGroup) ?? []), index]);
  });
  for (const positions of groups.values()) {
    const shuffled = shuffle(positions.map((index) => order[index] ?? ''));
    positions.forEach((position, i) => {
      order[position] = shuffled[i] ?? '';
    });
  }
  return order;
}

export function walkSurvey(survey: FlowSurvey, state: RespondentState): FlowWalk {
  const questionsByCode = new Map<string, FlowQuestion>(
    survey.blocks.flatMap((block) => block.questions.map((question) => [question.code, question])),
  );
  const ctx = {
    answer: (code: string) => state.answers.get(code),
    assignment: (name: string) => state.assignments[name] as string | string[] | undefined,
  };
  const answeredVisible = new Set<string>();
  let current: PresentedQuestion | undefined;
  let remaining = 0;
  let pendingAssignment: string | undefined;

  /**
   * Visible? Before the current screen is found, a missing test group must be assigned first;
   * after it, questions that depend on one are simply not counted yet.
   */
  const visible = (condition: Condition | null): boolean => {
    if (!condition) return true;
    const missing = referencedAssignments(condition).find((name) => !(name in state.assignments));
    if (missing) {
      if (!current) pendingAssignment ??= missing;
      return false;
    }
    return evaluateCondition(condition, ctx);
  };

  for (const block of orderedBlocks(survey, state)) {
    if (!visible(block.displayLogic)) {
      if (pendingAssignment) break;
      continue;
    }
    for (const question of block.questions) {
      if (!visible(question.displayLogic)) {
        if (pendingAssignment) break;
        continue;
      }
      if (state.answers.has(question.code)) {
        answeredVisible.add(question.code);
        continue;
      }
      const presented = presentQuestion(question, state, questionsByCode);
      if (presented.kind === 'needs_assignment') {
        if (!current) {
          pendingAssignment = presented.name;
          break;
        }
        continue;
      }
      if (presented.kind === 'empty') continue;
      current ??= presented.question;
      remaining++;
    }
    if (pendingAssignment) break;
  }

  if (pendingAssignment) {
    return { step: { kind: 'needs_assignment', name: pendingAssignment }, answeredVisible };
  }
  if (!current) return { step: { kind: 'done' }, answeredVisible };
  const answered = answeredVisible.size;
  return {
    step: {
      kind: 'screen',
      question: current,
      progress: Math.round((answered / (answered + remaining)) * 100),
    },
    answeredVisible,
  };
}
