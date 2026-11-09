import { describe, expect, it } from 'vitest';
import { conditionSchema, referencedQuestions } from './conditions.js';

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
});
