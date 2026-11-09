import { qualitySettingsSchema, type QualitySettingsInput } from '@survey-dynata/shared';
import { describe, expect, it } from 'vitest';
import {
  isStraightlined,
  passesAttentionCheck,
  runQualityChecks,
  type CheckedAnswer,
} from './checks.js';

const settings = (input: QualitySettingsInput = {}) => qualitySettingsSchema.parse(input);

const grid = (
  code: string,
  rows: Record<string, unknown>,
  attention?: CheckedAnswer['attentionAnswer'],
): CheckedAnswer => ({
  code,
  type: 'grid_single',
  value: { rows },
  attentionAnswer: attention ?? null,
});

const flat = grid('G1', { a: '3', b: '3', c: '3', d: '3' });
const varied = grid('G2', { a: '1', b: '3', c: '3', d: '5' });
const attention = (answer: string) =>
  grid('ATT', { a: '1', check: answer, c: '2' }, { row: 'check', expected: ['4'] });

describe('quality settings', () => {
  it('defaults to flagging speeders and straightliners and terminating failed attention checks', () => {
    expect(settings()).toEqual({
      speeder: { action: 'flag', shareOfMedian: 1 / 3, minCompletesForMedian: 20 },
      straightlining: { action: 'flag', minRows: 4 },
      attentionCheck: { action: 'terminate', allowedFailures: 0 },
    });
  });
});

describe('speeders', () => {
  const run = (interviewSeconds: number, action: 'flag' | 'terminate' | 'off' = 'flag') =>
    runQualityChecks({
      settings: settings({ speeder: { action } }),
      interviewSeconds,
      referenceSeconds: 900,
      answers: [],
    });

  it('flags interviews shorter than a third of the reference length', () => {
    expect(run(299)).toEqual({ flags: ['speeder'], terminate: false });
    expect(run(300)).toEqual({ flags: [], terminate: false });
  });

  it('terminates when set to, and does nothing when off or without a reference', () => {
    expect(run(100, 'terminate').terminate).toBe(true);
    expect(run(100, 'off').flags).toEqual([]);
    expect(
      runQualityChecks({
        settings: settings(),
        interviewSeconds: 1,
        referenceSeconds: null,
        answers: [],
      }).flags,
    ).toEqual([]);
  });
});

describe('straightlining', () => {
  it('detects the same answer in every row of a large enough grid', () => {
    expect(isStraightlined(flat.value, 4)).toBe(true);
    expect(isStraightlined(flat.value, 5)).toBe(false);
    expect(isStraightlined(varied.value, 2)).toBe(false);
    expect(isStraightlined({ rows: { a: ['1', '2'], b: ['2', '1'], c: ['1', '2'] } }, 3)).toBe(
      true,
    );
  });

  it('flags each straightlined grid, ignoring attention-check grids', () => {
    const result = runQualityChecks({
      settings: settings({ straightlining: { action: 'terminate', minRows: 3 } }),
      interviewSeconds: 600,
      referenceSeconds: 600,
      answers: [
        flat,
        varied,
        grid('ATT', { a: '4', b: '4', c: '4' }, { row: 'b', expected: ['4'] }),
      ],
    });
    expect(result).toEqual({ flags: ['straightlining:G1'], terminate: true });
  });
});

describe('attention checks', () => {
  it('compares the expected row or options; unanswered checks pass', () => {
    expect(passesAttentionCheck({ rows: { check: '4' } }, { row: 'check', expected: ['4'] })).toBe(
      true,
    );
    expect(passesAttentionCheck({ rows: { check: '2' } }, { row: 'check', expected: ['4'] })).toBe(
      false,
    );
    expect(passesAttentionCheck({ optionIds: ['b', 'a'] }, { expected: ['a', 'b'] })).toBe(true);
    expect(passesAttentionCheck({ optionIds: ['a'] }, { expected: ['a', 'b'] })).toBe(false);
    expect(passesAttentionCheck(undefined, { expected: ['a'] })).toBe(true);
  });

  it('terminates beyond the allowed failures and otherwise only flags', () => {
    const run = (input: QualitySettingsInput) =>
      runQualityChecks({
        settings: settings(input),
        interviewSeconds: 600,
        referenceSeconds: 600,
        answers: [attention('1')],
      });
    expect(run({})).toEqual({ flags: ['attention_check:ATT'], terminate: true });
    expect(run({ attentionCheck: { allowedFailures: 1 } }).terminate).toBe(false);
    expect(run({ attentionCheck: { action: 'flag' } })).toEqual({
      flags: ['attention_check:ATT'],
      terminate: false,
    });
    expect(
      runQualityChecks({
        settings: settings(),
        interviewSeconds: 600,
        referenceSeconds: 600,
        answers: [attention('4')],
      }),
    ).toEqual({ flags: [], terminate: false });
  });
});
