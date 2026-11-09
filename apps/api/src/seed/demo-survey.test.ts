import { conditionSchema, parseQuestionConfig, referencedQuestions } from '@survey-dynata/shared';
import { QuestionType } from '@survey-dynata/shared/db';
import { describe, expect, it } from 'vitest';
import { demoBlocks, demoQuotaCells } from './demo-survey.js';

const questions = demoBlocks.flatMap((block) => block.questions);
const codes = new Set(questions.map((question) => question.code));

describe('demo survey', () => {
  it('contains every question type', () => {
    const used = new Set(questions.map((question) => question.type));
    expect([...used].sort()).toEqual(Object.values(QuestionType).sort());
  });

  it('has unique question codes', () => {
    expect(codes.size).toBe(questions.length);
  });

  it.each(questions.map((question) => [question.code, question] as const))(
    '%s config matches its type',
    (_code, question) => {
      expect(() => parseQuestionConfig(question.type, question.config)).not.toThrow();
    },
  );

  it('has screeners whose rules reference existing questions', () => {
    const rules = questions.flatMap((question) => (question.screenOut ? [question.screenOut] : []));
    expect(rules.length).toBeGreaterThanOrEqual(2);
    for (const rule of rules) {
      expect(
        referencedQuestions(conditionSchema.parse(rule)).every((code) => codes.has(code)),
      ).toBe(true);
    }
  });

  it('has two quota cells on existing questions', () => {
    expect(demoQuotaCells).toHaveLength(2);
    for (const cell of demoQuotaCells) {
      expect(codes.has(cell.conditions.question)).toBe(true);
    }
  });
});
