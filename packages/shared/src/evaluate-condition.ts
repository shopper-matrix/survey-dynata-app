import type { Condition } from './conditions.js';

// Evaluates a condition against a respondent's answers and test-group assignments. Pure, so the
// API flow engine, the screening engine and builder previews all use the same rules.

export interface ConditionContext {
  /** The stored answer value for a question code, or undefined if not answered. */
  answer(questionCode: string): unknown;
  /** The respondent's value(s) for an assignment, or undefined if not assigned yet. */
  assignment(name: string): string | string[] | undefined;
}

/** Choice ids of an answer: single choice → one id, multiple choice → all ids. */
export function chosenIds(answer: unknown): string[] {
  if (typeof answer !== 'object' || answer === null) return [];
  if ('optionIds' in answer && Array.isArray(answer.optionIds)) return answer.optionIds.map(String);
  if ('optionId' in answer && typeof answer.optionId === 'string') return [answer.optionId];
  return [];
}

/** Single value of an answer: the chosen option id or the entered number. */
function scalar(answer: unknown): string | number | undefined {
  if (typeof answer !== 'object' || answer === null) return undefined;
  if ('optionId' in answer && typeof answer.optionId === 'string') return answer.optionId;
  if ('value' in answer && typeof answer.value === 'number') return answer.value;
  return undefined;
}

const same = (a: string | number, b: string | number) => String(a) === String(b);

/** Unanswered questions make every comparison false (the respondent didn't see them). */
export function evaluateCondition(condition: Condition, ctx: ConditionContext): boolean {
  if ('all' in condition) return condition.all.every((part) => evaluateCondition(part, ctx));
  if ('any' in condition) return condition.any.some((part) => evaluateCondition(part, ctx));

  if ('assignment' in condition) {
    const assigned = ctx.assignment(condition.assignment);
    if (assigned === undefined) return false;
    const have = Array.isArray(assigned) ? assigned : [assigned];
    const want = Array.isArray(condition.value) ? condition.value : [condition.value];
    return want.some((value) => have.includes(value));
  }

  const answer = ctx.answer(condition.question);
  if (answer === undefined) return false;
  const value = scalar(answer);
  const numeric = typeof value === 'number' ? value : undefined;

  switch (condition.op) {
    case 'equals':
      return value !== undefined && same(value, condition.value);
    case 'not_equals':
      return value !== undefined && !same(value, condition.value);
    case 'in':
      return value !== undefined && condition.value.some((option) => same(option, value));
    case 'not_in':
      return value !== undefined && !condition.value.some((option) => same(option, value));
    case 'lt':
      return numeric !== undefined && numeric < condition.value;
    case 'gt':
      return numeric !== undefined && numeric > condition.value;
    case 'between':
      return (
        numeric !== undefined && numeric >= condition.value.min && numeric <= condition.value.max
      );
    case 'includes_any':
      return chosenIds(answer).some((choice) => condition.value.includes(choice));
    case 'includes_none':
      return !chosenIds(answer).some((choice) => condition.value.includes(choice));
  }
}
