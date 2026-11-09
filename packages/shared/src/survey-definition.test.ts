import { describe, expect, it } from 'vitest';
import { surveyDefinitionSchema, type SurveyDefinitionInput } from './survey-definition.js';

const options = [
  { id: '1', label: 'Yes' },
  { id: '2', label: 'No' },
];

function definition(overrides: Partial<SurveyDefinitionInput> = {}): SurveyDefinitionInput {
  return {
    survey: {
      id: '019a0000-0000-7000-8000-00000000abcd',
      title: 'Test',
      language: 'de',
      targetCompletes: 10,
    },
    assignments: [{ name: 'cell', values: ['A', 'B'] }],
    blocks: [
      {
        code: 'A',
        title: 'Screening',
        questions: [
          { code: 'Q1', type: 'single_choice', text: 'Q1?', config: { options } },
          {
            code: 'Q2',
            type: 'multi_choice',
            text: 'Q2?',
            config: { options, pipeFrom: { question: 'Q1' } },
            displayLogic: { assignment: 'cell', op: 'equals', value: 'A' },
            screenOut: { question: 'Q1', op: 'includes_none', value: ['1'] },
          },
        ],
      },
    ],
    ...overrides,
  };
}

const messages = (input: SurveyDefinitionInput) => {
  const result = surveyDefinitionSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('surveyDefinitionSchema', () => {
  it('accepts a valid definition and fills in defaults', () => {
    const parsed = surveyDefinitionSchema.parse(definition());
    expect(parsed.quotas).toEqual([]);
    expect(parsed.assignments[0]).toMatchObject({ pick: 1, stratifyBy: [] });
    expect(parsed.blocks[0]?.questions[0]).toMatchObject({
      isScreener: false,
      notes: [],
      config: { options, randomize: false },
    });
  });

  it('validates each config against its question type, with the path', () => {
    const input = definition();
    const question = input.blocks[0]?.questions[0];
    if (question) question.config = { options: [options[0]] };
    const result = surveyDefinitionSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([
      'blocks',
      0,
      'questions',
      0,
      'config',
      'options',
    ]);
  });

  it('rejects duplicate question and block codes', () => {
    const input = definition();
    input.blocks.push({
      code: 'A',
      title: 'Again',
      questions: [{ code: 'Q1', type: 'single_choice', text: 'Again?', config: { options } }],
    });
    expect(messages(input)).toEqual(
      expect.arrayContaining(['Duplicate question code Q1', 'Block codes must be unique']),
    );
  });

  it('rejects references to unknown questions and assignments', () => {
    const input = definition({ assignments: [] });
    const question = input.blocks[0]?.questions[1];
    if (question) {
      question.config = { options, pipeFrom: { question: 'Q9' } };
      question.screenOut = { question: 'Q8', op: 'equals', value: 1 };
    }
    expect(messages(input)).toEqual(
      expect.arrayContaining([
        'Q2: unknown assignment cell',
        'Q2: unknown question Q8',
        'Q2: pipes from unknown question Q9',
      ]),
    );
  });

  it('rejects an assignment that picks all its values or stratifies by an unknown question', () => {
    expect(
      messages(definition({ assignments: [{ name: 'cell', values: ['A', 'B'], pick: 2 }] })),
    ).toContain('pick must be below the number of values');
    expect(
      messages(
        definition({ assignments: [{ name: 'cell', values: ['A', 'B'], stratifyBy: ['X1'] }] }),
      ),
    ).toContain('Assignment cell: unknown question X1');
  });
});
