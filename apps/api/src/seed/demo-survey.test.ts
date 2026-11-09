import { surveyDefinitionSchema } from '@survey-dynata/shared';
import { QuestionType } from '@survey-dynata/shared/db';
import { describe, expect, it } from 'vitest';
import { demoDefinition } from './demo-survey.js';

describe('demo survey', () => {
  // Also checks every config against its type, unique codes and that all screening rules,
  // quotas and display logic reference existing questions.
  const definition = surveyDefinitionSchema.parse(demoDefinition);
  const questions = definition.blocks.flatMap((block) => block.questions);

  it('contains every question type', () => {
    const used = new Set(questions.map((question) => question.type));
    expect([...used].sort()).toEqual(Object.values(QuestionType).sort());
  });

  it('has at least two screeners with screen-out rules and two quota cells', () => {
    expect(questions.filter((question) => question.screenOut).length).toBeGreaterThanOrEqual(2);
    expect(definition.quotas).toHaveLength(2);
  });
});
