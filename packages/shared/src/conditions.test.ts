import { describe, expect, it } from 'vitest';
import { conditionSchema, referencedAssignments, referencedQuestions } from './conditions.js';

describe('conditionSchema', () => {
  it('accepts nested AND / OR conditions', () => {
    const condition = {
      any: [
        { question: 'A1', op: 'lt', value: 18 },
        {
          all: [
            { question: 'A2', op: 'equals', value: 'female' },
            { question: 'A1', op: 'gt', value: 69 },
          ],
        },
      ],
    };
    expect(conditionSchema.parse(condition)).toEqual(condition);
  });

  it('rejects a value that does not fit the operator', () => {
    expect(conditionSchema.safeParse({ question: 'A1', op: 'lt', value: 'young' }).success).toBe(
      false,
    );
    expect(conditionSchema.safeParse({ question: 'A1', op: 'in', value: [] }).success).toBe(false);
  });

  it('lists every referenced question', () => {
    const condition = conditionSchema.parse({
      all: [
        { question: 'A1', op: 'between', value: { min: 18, max: 69 } },
        { any: [{ question: 'A3', op: 'includes_any', value: ['retail'] }] },
      ],
    });
    expect(referencedQuestions(condition)).toEqual(['A1', 'A3']);
  });

  it('supports "includes none" and conditions on test-group assignments', () => {
    const condition = conditionSchema.parse({
      all: [
        { question: 'A6', op: 'includes_none', value: ['bars'] },
        { assignment: 'H3', op: 'equals', value: 'B' },
        { assignment: 'G9', op: 'in', value: ['v1', 'v2'] },
      ],
    });
    expect(referencedQuestions(condition)).toEqual(['A6']);
    expect(referencedAssignments(condition)).toEqual(['H3', 'G9']);
  });
});
