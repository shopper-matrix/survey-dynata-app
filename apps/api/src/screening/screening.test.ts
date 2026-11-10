import type { Condition, ConditionContext } from '@survey-dynata/shared';
import { describe, expect, it } from 'vitest';
import { failsScreening } from './screening.js';

const respondent = (answers: Record<string, unknown>): ConditionContext => ({
  answer: (code) => answers[code],
  assignment: () => undefined,
});

// Every rule type with one respondent who passes and one who is screened out.
const cases: [name: string, rule: Condition, passes: unknown, fails: unknown][] = [
  [
    'equals',
    { question: 'Q', op: 'equals', value: 'other' },
    { optionId: 'me' },
    { optionId: 'other' },
  ],
  [
    'not equals',
    { question: 'Q', op: 'not_equals', value: 'de' },
    { optionId: 'de' },
    { optionId: 'fr' },
  ],
  ['in list', { question: 'Q', op: 'in', value: ['a', 'b'] }, { optionId: 'c' }, { optionId: 'b' }],
  [
    'not in list',
    { question: 'Q', op: 'not_in', value: ['a', 'b'] },
    { optionId: 'a' },
    { optionId: 'z' },
  ],
  ['below', { question: 'Q', op: 'lt', value: 18 }, { value: 18 }, { value: 17 }],
  ['above', { question: 'Q', op: 'gt', value: 69 }, { value: 69 }, { value: 70 }],
  [
    'range',
    { question: 'Q', op: 'between', value: { min: 0, max: 17 } },
    { value: 30 },
    { value: 16 },
  ],
  [
    'includes any',
    { question: 'Q', op: 'includes_any', value: ['mafo'] },
    { optionIds: ['none'] },
    { optionIds: ['retail', 'mafo'] },
  ],
  [
    'includes none',
    { question: 'Q', op: 'includes_none', value: ['bars'] },
    { optionIds: ['bars'] },
    { optionIds: ['chips'] },
  ],
  [
    'AND',
    {
      all: [
        { question: 'Q', op: 'gt', value: 60 },
        { question: 'Q', op: 'lt', value: 65 },
      ],
    },
    { value: 70 },
    { value: 62 },
  ],
  [
    'OR',
    {
      any: [
        { question: 'Q', op: 'lt', value: 18 },
        { question: 'Q', op: 'gt', value: 69 },
      ],
    },
    { value: 40 },
    { value: 80 },
  ],
];

describe('failsScreening', () => {
  it.each(cases)(
    '%s: passes one respondent, screens out the other',
    (_name, rule, passes, fails) => {
      expect(failsScreening([rule], respondent({ Q: passes }))).toBe(false);
      expect(failsScreening([rule], respondent({ Q: fails }))).toBe(true);
    },
  );

  it('screens out when any of several rules matches', () => {
    const rules: Condition[] = [
      { question: 'Q', op: 'equals', value: 'a' },
      { question: 'Q', op: 'equals', value: 'b' },
    ];
    expect(failsScreening(rules, respondent({ Q: { optionId: 'b' } }))).toBe(true);
    expect(failsScreening(rules, respondent({ Q: { optionId: 'c' } }))).toBe(false);
    expect(failsScreening([], respondent({ Q: { optionId: 'a' } }))).toBe(false);
  });
});
