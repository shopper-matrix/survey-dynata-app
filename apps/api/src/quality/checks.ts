import { chosenIds, type AttentionAnswer, type QualitySettings } from '@survey-dynata/shared';
import type { QuestionType } from '@survey-dynata/shared/db';

// Quality checks run when a respondent finishes (DSA-501). Pure: the caller loads the answers
// and the reference interview length; this decides the flags and whether to terminate.

export interface CheckedAnswer {
  code: string;
  type: QuestionType;
  value: unknown;
  /** Set for attention checks only. */
  attentionAnswer: AttentionAnswer | null;
}

export interface QualityInput {
  settings: QualitySettings;
  /** Seconds from consent to finish. */
  interviewSeconds: number;
  /** Median length of completes, or the estimated length; null when neither is known. */
  referenceSeconds: number | null;
  answers: CheckedAnswer[];
}

export interface QualityResult {
  /** e.g. `speeder`, `straightlining:Q5`, `attention_check:Q9`. */
  flags: string[];
  terminate: boolean;
}

function gridRows(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null || !('rows' in value)) return [];
  return typeof value.rows === 'object' && value.rows !== null ? Object.values(value.rows) : [];
}

const answerKey = (cell: unknown) =>
  Array.isArray(cell) ? cell.map(String).sort().join('|') : String(cell);

/** Same answer in every row of a grid with at least `minRows` rows answered. */
export function isStraightlined(value: unknown, minRows: number): boolean {
  const rows = gridRows(value).map(answerKey);
  return rows.length >= minRows && new Set(rows).size === 1;
}

/** Whether the answer matches the expected option(s); unanswered checks count as passed. */
export function passesAttentionCheck(value: unknown, expected: AttentionAnswer): boolean {
  let chosen: string[];
  if (expected.row !== undefined) {
    const rows = (value as { rows?: Record<string, unknown> } | undefined)?.rows;
    const cell = rows?.[expected.row];
    if (cell === undefined) return true;
    chosen = (Array.isArray(cell) ? cell : [cell]).filter((id) => typeof id === 'string');
  } else {
    chosen = chosenIds(value);
    if (chosen.length === 0) return true;
  }
  return (
    chosen.length === expected.expected.length &&
    chosen.every((id) => expected.expected.includes(id))
  );
}

export function runQualityChecks(input: QualityInput): QualityResult {
  const { settings } = input;
  const flags: string[] = [];
  let terminate = false;

  const { speeder } = settings;
  if (
    speeder.action !== 'off' &&
    input.referenceSeconds !== null &&
    input.interviewSeconds < input.referenceSeconds * speeder.shareOfMedian
  ) {
    flags.push('speeder');
    terminate ||= speeder.action === 'terminate';
  }

  const { straightlining } = settings;
  if (straightlining.action !== 'off') {
    for (const answer of input.answers) {
      const isGrid = answer.type === 'grid_single' || answer.type === 'grid_multi';
      // Attention-check grids are answered on purpose with one different row; skip them.
      if (
        isGrid &&
        !answer.attentionAnswer &&
        isStraightlined(answer.value, straightlining.minRows)
      ) {
        flags.push(`straightlining:${answer.code}`);
        terminate ||= straightlining.action === 'terminate';
      }
    }
  }

  const { attentionCheck } = settings;
  if (attentionCheck.action !== 'off') {
    const failed = input.answers.filter(
      (answer) =>
        answer.attentionAnswer && !passesAttentionCheck(answer.value, answer.attentionAnswer),
    );
    flags.push(...failed.map((answer) => `attention_check:${answer.code}`));
    terminate ||=
      attentionCheck.action === 'terminate' && failed.length > attentionCheck.allowedFailures;
  }

  return { flags, terminate };
}
