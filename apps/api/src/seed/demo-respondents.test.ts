import { answerSchema } from '@survey-dynata/shared';
import { describe, expect, it } from 'vitest';
import { buildDemoRespondents, RESPONDENT_MIX } from './demo-respondents.js';
import { demoBlocks, demoQuotaCells } from './demo-survey.js';

const respondents = buildDemoRespondents();
const byStatus = (status: string) => respondents.filter((r) => r.status === status);
const answered = (respondent: (typeof respondents)[number]) =>
  respondent.answers.map((answer) => answer.questionCode);

describe('demo respondents', () => {
  it('only gives answers in the shared answer format', () => {
    const questions = new Map(demoBlocks.flatMap((b) => b.questions.map((q) => [q.code, q])));
    for (const respondent of respondents) {
      for (const answer of respondent.answers) {
        const question = questions.get(answer.questionCode);
        if (!question) throw new Error(`Unknown question ${answer.questionCode}`);
        const result = answerSchema(question.type, question.config).safeParse(answer.value);
        expect(
          result.error?.issues,
          `${respondent.panelRespondentId} ${answer.questionCode}`,
        ).toBeUndefined();
      }
    }
  });

  it('creates 50 respondents with obviously fake, unique IDs', () => {
    expect(respondents).toHaveLength(50);
    expect(respondents.every((r) => /^TEST-\d{4}$/.test(r.panelRespondentId))).toBe(true);
    expect(new Set(respondents.map((r) => r.panelRespondentId)).size).toBe(50);
  });

  it('covers every outcome in the planned mix', () => {
    for (const [status, count] of Object.entries(RESPONDENT_MIX)) {
      expect(byStatus(status)).toHaveLength(count);
    }
  });

  it('is identical on every run', () => {
    expect(buildDemoRespondents()).toEqual(respondents);
  });

  it('keeps completes within the quota targets and fills the Men cell', () => {
    const completesWith = (gender: string) =>
      byStatus('complete').filter((r) =>
        r.answers.some((a) => a.questionCode === 'A2' && a.value.optionId === gender),
      ).length;
    for (const cell of demoQuotaCells) {
      expect(completesWith(cell.conditions.value)).toBeLessThanOrEqual(cell.target);
    }
    expect(completesWith('male')).toBe(demoQuotaCells.find((c) => c.name === 'Men')?.target);
  });

  it('stops screen-outs at the failing screener', () => {
    for (const respondent of byStatus('screenout')) {
      const codes = answered(respondent);
      expect(['A1', 'A3']).toContain(codes.at(-1));
      expect(codes.some((code) => !code.startsWith('A'))).toBe(false);
    }
  });

  it('flags every quality termination and only those', () => {
    expect(byStatus('quality').every((r) => r.qualityFlags.length === 1)).toBe(true);
    expect(
      respondents.filter((r) => r.status !== 'quality').every((r) => r.qualityFlags.length === 0),
    ).toBe(true);
  });

  it('sets an end time only for finished respondents', () => {
    const open = respondents.filter((r) => r.status === 'started' || r.status === 'abandoned');
    expect(open.every((r) => r.endedAt === null)).toBe(true);
    expect(respondents.filter((r) => !open.includes(r)).every((r) => r.endedAt !== null)).toBe(
      true,
    );
  });
});
