import { describe, expect, it } from 'vitest';
import { parseQuestionConfig, questionConfigSchemas } from './config.js';

const options = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];

describe('question config schemas', () => {
  it('applies defaults', () => {
    expect(parseQuestionConfig('single_choice', { options })).toEqual({
      options,
      randomize: false,
    });
  });

  it('rejects duplicate option ids', () => {
    expect(() =>
      parseQuestionConfig('single_choice', { options: [options[0], options[0]] }),
    ).toThrow(/unique/);
  });

  it('rejects a range whose min is not below max', () => {
    expect(() =>
      parseQuestionConfig('rating', { min: 5, max: 5, lowLabel: 'low', highLabel: 'high' }),
    ).toThrow(/min must be below max/);
  });

  it('checks MaxDiff sets against the item list and set size', () => {
    const valid = { items: options, itemsPerSet: 3, sets: [['a', 'b', 'c']] };
    expect(questionConfigSchemas.maxdiff.safeParse(valid).success).toBe(true);
    expect(questionConfigSchemas.maxdiff.safeParse({ ...valid, sets: [['a', 'b']] }).success).toBe(
      false,
    );
    expect(
      questionConfigSchemas.maxdiff.safeParse({ ...valid, sets: [['a', 'b', 'x']] }).success,
    ).toBe(false);
  });

  it('requires paired comparisons to use two different known items', () => {
    const base = {
      items: [
        { id: 'p1', label: 'Pack 1' },
        { id: 'p2', label: 'Pack 2' },
      ],
      questions: [{ id: 'q', label: 'Which looks tastier?' }],
    };
    const ok = questionConfigSchemas.paired_comparison.safeParse({
      ...base,
      pairs: [['p1', 'p2']],
    });
    const same = questionConfigSchemas.paired_comparison.safeParse({
      ...base,
      pairs: [['p1', 'p1']],
    });
    expect(ok.success).toBe(true);
    expect(same.success).toBe(false);
  });
});
