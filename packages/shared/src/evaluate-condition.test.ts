import { describe, expect, it } from 'vitest';
import type { Condition } from './conditions.js';
import { evaluateCondition, type ConditionContext } from './evaluate-condition.js';

const answers: Record<string, unknown> = {
  age: { value: 34 },
  gender: { optionId: 'f' },
  bars: { optionIds: ['1', '6'] },
};
const assignments: Record<string, string | string[]> = { cell: 'B', claims: ['v1', 'v4'] };
const ctx: ConditionContext = {
  answer: (code) => answers[code],
  assignment: (name) => assignments[name],
};
const check = (condition: Condition) => evaluateCondition(condition, ctx);

describe('evaluateCondition', () => {
  it('compares single values', () => {
    expect(check({ question: 'gender', op: 'equals', value: 'f' })).toBe(true);
    expect(check({ question: 'gender', op: 'not_equals', value: 'f' })).toBe(false);
    expect(check({ question: 'gender', op: 'in', value: ['m', 'f'] })).toBe(true);
    expect(check({ question: 'gender', op: 'not_in', value: ['m'] })).toBe(true);
    expect(check({ question: 'age', op: 'equals', value: 34 })).toBe(true);
  });

  it('compares numbers', () => {
    expect(check({ question: 'age', op: 'lt', value: 18 })).toBe(false);
    expect(check({ question: 'age', op: 'gt', value: 18 })).toBe(true);
    expect(check({ question: 'age', op: 'between', value: { min: 25, max: 34 } })).toBe(true);
    expect(check({ question: 'gender', op: 'gt', value: 1 })).toBe(false);
  });

  it('checks multiple-choice selections', () => {
    expect(check({ question: 'bars', op: 'includes_any', value: ['6'] })).toBe(true);
    expect(check({ question: 'bars', op: 'includes_none', value: ['6'] })).toBe(false);
    expect(check({ question: 'bars', op: 'includes_none', value: ['4', '5'] })).toBe(true);
    expect(check({ question: 'gender', op: 'includes_any', value: ['f'] })).toBe(true);
  });

  it('treats unanswered questions as not matching anything', () => {
    expect(check({ question: 'missing', op: 'not_equals', value: 'x' })).toBe(false);
    expect(check({ question: 'missing', op: 'includes_none', value: ['x'] })).toBe(false);
  });

  it('checks test-group assignments, including multi-value ones', () => {
    expect(check({ assignment: 'cell', op: 'equals', value: 'B' })).toBe(true);
    expect(check({ assignment: 'cell', op: 'in', value: ['A', 'C'] })).toBe(false);
    expect(check({ assignment: 'claims', op: 'equals', value: 'v4' })).toBe(true);
    expect(check({ assignment: 'unassigned', op: 'equals', value: 'A' })).toBe(false);
  });

  it('combines conditions with all / any', () => {
    expect(
      check({
        all: [
          { question: 'age', op: 'gt', value: 18 },
          {
            any: [
              { assignment: 'cell', op: 'equals', value: 'A' },
              { question: 'gender', op: 'equals', value: 'f' },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
