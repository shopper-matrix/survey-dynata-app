import { chosenIds } from '@survey-dynata/shared';
import { randomFromText } from '../lib/random.js';
import type { FlowQuestion, PresentedQuestion, RespondentState } from './types.js';

// Turns a stored question into what one respondent sees: piping filters the options or rows,
// randomisation shuffles them (the same way on every reload), split cells pick the stimulus.

interface Item {
  id: string;
  exclusive?: boolean;
}

export type PresentResult =
  | { kind: 'question'; question: PresentedQuestion }
  /** Piping left nothing to ask: the question is skipped. */
  | { kind: 'empty' }
  /** The question depends on a test group the respondent has not been assigned to yet. */
  | { kind: 'needs_assignment'; name: string };

/** Shuffles items; exclusive ones ("none of these") stay at the end. */
function shuffle<T extends Item>(items: T[], seed: string): T[] {
  const regular = items.filter((item) => !item.exclusive);
  const exclusive = items.filter((item) => item.exclusive);
  return [...randomFromText(seed).shuffle(regular), ...exclusive];
}

/** Ids picked in the source question (grids: rows with at least one non-exclusive answer). */
function pipedIds(source: FlowQuestion | undefined, state: RespondentState): Set<string> {
  if (!source) return new Set();
  const answer = state.answers.get(source.code);
  if (!answer) return new Set();
  const rows = answer.rows as Record<string, string | string[]> | undefined;
  if (rows) {
    const exclusive = new Set(
      ((source.config.columns as Item[] | undefined) ?? [])
        .filter((column) => column.exclusive)
        .map((column) => column.id),
    );
    return new Set(
      Object.entries(rows)
        .filter(([, value]) =>
          (Array.isArray(value) ? value : [value]).some((v) => !exclusive.has(v)),
        )
        .map(([rowId]) => rowId),
    );
  }
  return new Set(chosenIds(answer));
}

export function presentQuestion(
  question: FlowQuestion,
  state: RespondentState,
  questionsByCode: Map<string, FlowQuestion>,
): PresentResult {
  const { pipeFrom, randomize, randomizeRows, assignment, ...config } = question.config as {
    pipeFrom?: { question: string };
    randomize?: boolean;
    randomizeRows?: boolean;
    assignment?: string;
  } & Record<string, unknown>;
  const seed = `${state.respondentId}:${question.code}`;
  const listKey = question.type.startsWith('grid_') ? 'rows' : 'options';

  if (pipeFrom) {
    const keep = pipedIds(questionsByCode.get(pipeFrom.question), state);
    const items = (config[listKey] as Item[]).filter(
      (item) => item.exclusive === true || keep.has(item.id),
    );
    if (!items.some((item) => !item.exclusive)) return { kind: 'empty' };
    config[listKey] = items;
  }
  if (randomize === true || randomizeRows === true) {
    config[listKey] = shuffle(config[listKey] as Item[], seed);
  }

  if (question.type === 'timed_exposure') {
    const stimuli = config.stimuli as Item[];
    let shown = stimuli[0];
    if (assignment) {
      const value = state.assignments[assignment];
      if (value === undefined) return { kind: 'needs_assignment', name: assignment };
      shown = stimuli.find((stimulus) => stimulus.id === value) ?? shown;
    }
    config.stimuli = shown ? [shown] : [];
  }

  return {
    kind: 'question',
    question: { code: question.code, type: question.type, text: question.text, config },
  };
}
