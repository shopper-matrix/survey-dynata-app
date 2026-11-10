import { describe, expect, it } from 'vitest';
import { answerSchema } from './answers.js';
import type { QuestionType } from './generated/prisma/enums.js';

const options = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'none', label: 'None', exclusive: true },
];

const valid = (type: QuestionType, config: unknown, value: unknown) =>
  answerSchema(type, config).safeParse(value).success;

describe('answerSchema', () => {
  it('info: acknowledges the screen', () => {
    expect(valid('info', { body: 'Hi' }, { seen: true })).toBe(true);
    expect(valid('info', { body: 'Hi' }, {})).toBe(false);
  });

  it('single choice: one known option, nothing else', () => {
    expect(valid('single_choice', { options }, { optionId: 'a' })).toBe(true);
    expect(valid('single_choice', { options }, { optionId: 'x' })).toBe(false);
    expect(valid('single_choice', { options }, { optionId: 'a', extra: 1 })).toBe(false);
  });

  it('multi choice: known, unique options; exclusive option alone; min/max', () => {
    const config = { options, maxSelected: 2 };
    expect(valid('multi_choice', config, { optionIds: ['a', 'b'] })).toBe(true);
    expect(valid('multi_choice', config, { optionIds: ['none'] })).toBe(true);
    expect(valid('multi_choice', config, { optionIds: ['a', 'none'] })).toBe(false);
    expect(valid('multi_choice', config, { optionIds: ['a', 'a'] })).toBe(false);
    expect(valid('multi_choice', config, { optionIds: [] })).toBe(false);
    expect(valid('multi_choice', { options, minSelected: 2 }, { optionIds: ['a'] })).toBe(false);
  });

  it('grids: every row answered with known columns', () => {
    const config = {
      rows: [
        { id: 'r1', label: 'R1' },
        { id: 'r2', label: 'R2' },
      ],
      columns: options,
    };
    expect(valid('grid_single', config, { rows: { r1: 'a', r2: 'b' } })).toBe(true);
    expect(valid('grid_single', config, { rows: { r1: 'a' } })).toBe(false);
    expect(valid('grid_single', config, { rows: { r1: 'a', r2: 'b', r3: 'a' } })).toBe(false);
    expect(valid('grid_multi', config, { rows: { r1: ['a', 'b'], r2: ['none'] } })).toBe(true);
    expect(valid('grid_multi', config, { rows: { r1: ['a', 'none'], r2: ['b'] } })).toBe(false);
  });

  it('open text, number, rating: length and range', () => {
    expect(valid('open_text', { minLength: 2, maxLength: 5 }, { text: 'abc' })).toBe(true);
    expect(valid('open_text', { minLength: 2, maxLength: 5 }, { text: ' a ' })).toBe(false);
    expect(valid('open_text', { minLength: 0, maxLength: 5 }, { text: 'abcdef' })).toBe(false);
    expect(valid('number', { min: 0, max: 10 }, { value: 4 })).toBe(true);
    expect(valid('number', { min: 0, max: 10 }, { value: 4.5 })).toBe(false);
    expect(valid('number', { min: 0, max: 10, integer: false }, { value: 4.5 })).toBe(true);
    expect(valid('rating', { min: 0, max: 10, lowLabel: 'l', highLabel: 'h' }, { value: 11 })).toBe(
      false,
    );
  });

  it('slider and semantic differential: every item, "not applicable" only if allowed', () => {
    const slider = {
      min: 1,
      max: 7,
      lowLabel: 'l',
      highLabel: 'h',
      items: [{ id: 'p1', label: 'P1' }],
    };
    expect(valid('slider', slider, { values: { p1: 3 } })).toBe(true);
    expect(valid('slider', slider, { values: { p1: null } })).toBe(false);
    expect(valid('slider', { ...slider, allowNotApplicable: true }, { values: { p1: null } })).toBe(
      true,
    );
    const sd = { pairs: [{ id: 'x', left: 'dry', right: 'juicy' }], points: 7 };
    expect(valid('semantic_differential', sd, { values: { x: 7 } })).toBe(true);
    expect(valid('semantic_differential', sd, { values: { x: 8 } })).toBe(false);
  });

  it('MaxDiff: one best and one different worst per set, from that set', () => {
    const config = {
      items: [...options.slice(0, 2), { id: 'c', label: 'C' }],
      itemsPerSet: 3,
      sets: [['a', 'b', 'c']],
    };
    expect(valid('maxdiff', config, { sets: [{ best: 'a', worst: 'c' }] })).toBe(true);
    expect(valid('maxdiff', config, { sets: [{ best: 'a', worst: 'a' }] })).toBe(false);
    expect(valid('maxdiff', config, { sets: [] })).toBe(false);
  });

  it('constant sum: known options, points add up to the total', () => {
    const config = { options, total: 10 };
    expect(valid('constant_sum', config, { points: { a: 7, b: 3 } })).toBe(true);
    expect(valid('constant_sum', config, { points: { a: 7, b: 2 } })).toBe(false);
    expect(valid('constant_sum', config, { points: { a: 10, x: 0 } })).toBe(false);
  });

  it('mapping: positions for every item, or groups containing every item once', () => {
    const config = {
      stimuli: [
        { id: 's1', label: 'S1' },
        { id: 's2', label: 'S2' },
      ],
      mobile: 'sorting',
    };
    const positions = { s1: { x: 0.1, y: 0.9 }, s2: { x: 1, y: 0 } };
    expect(valid('mapping', config, { positions, input: 'drag' })).toBe(true);
    expect(
      valid('mapping', config, { positions: { s1: { x: 2, y: 0 }, s2: { x: 0, y: 0 } } }),
    ).toBe(false);
    expect(valid('mapping', config, { groups: [['s1'], ['s2']] })).toBe(true);
    expect(valid('mapping', config, { groups: [['s1']] })).toBe(false);
  });

  it('click map, paired comparison, timed exposure', () => {
    const map = {
      imageUrl: '/x.svg',
      imageAlt: 'x',
      zones: [{ id: 'z', label: 'Z', x: 0, y: 0, width: 10, height: 10 }],
      targets: [{ id: 't', label: 'T' }],
    };
    expect(valid('click_map', map, { clicks: { t: 'z' } })).toBe(true);
    expect(valid('click_map', map, { clicks: { t: 'nowhere' } })).toBe(false);

    const paired = {
      items: [
        { id: 'p1', label: 'P1' },
        { id: 'p2', label: 'P2' },
      ],
      pairs: [['p1', 'p2']],
      questions: [{ id: 'q', label: 'Which?' }],
    };
    const choice = (picked: string) => ({
      choices: [{ pair: ['p1', 'p2'], answers: { q: picked } }],
    });
    expect(valid('paired_comparison', paired, choice('p2'))).toBe(true);
    expect(valid('paired_comparison', paired, choice('p3'))).toBe(false);

    const timed = { stimuli: [{ id: 'p1', label: 'P1' }], exposureMs: 3000, options };
    expect(valid('timed_exposure', timed, { stimulusId: 'p1', optionId: 'a' })).toBe(true);
    expect(valid('timed_exposure', timed, { stimulusId: 'p9', optionId: 'a' })).toBe(false);
  });
});
