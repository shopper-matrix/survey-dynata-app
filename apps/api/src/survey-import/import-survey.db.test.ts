// Integration test: imports survey definitions into a real database.
import { randomUUID } from 'node:crypto';
import { surveyDefinitionSchema, type SurveyDefinitionInput } from '@survey-dynata/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { importSurvey, SurveyHasRespondentsError } from './import-survey.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);
const surveyId = randomUUID();
const options = [
  { id: '1', label: 'Ja' },
  { id: '2', label: 'Nein' },
];

const definition = (title: string, questionCount: number): SurveyDefinitionInput => ({
  survey: { id: surveyId, title, language: 'de', targetCompletes: 100, notes: ['note'] },
  assignments: [{ name: 'cell', values: ['A', 'B'] }],
  blocks: [
    {
      code: 'A',
      title: 'Screening',
      displayLogic: { assignment: 'cell', op: 'equals', value: 'A' },
      questions: Array.from({ length: questionCount }, (_, index) => ({
        code: `Q${String(index + 1)}`,
        type: 'single_choice' as const,
        text: `Frage ${String(index + 1)}`,
        config: { options },
        notes: ['PROG note'],
        screenOut: { question: 'Q1', op: 'equals' as const, value: '2' },
      })),
    },
  ],
  quotas: [
    {
      name: 'Minimum Ja',
      kind: 'minimum',
      target: 50,
      conditions: { question: 'Q1', op: 'equals', value: '1' },
    },
  ],
});

const run = (input: SurveyDefinitionInput) =>
  db.$transaction((tx) => importSurvey(tx, surveyDefinitionSchema.parse(input)));

afterAll(async () => {
  await db.survey.deleteMany({ where: { id: surveyId } });
  await db.$disconnect();
});

describe('importSurvey', () => {
  it('writes the survey as a draft with blocks, questions, rules, quotas and notes', async () => {
    const result = await run(definition('Erste Fassung', 2));
    expect(result.questions).toBe(2);

    const survey = await db.survey.findUniqueOrThrow({
      where: { id: surveyId },
      include: { blocks: true, questions: true, quotaCells: true },
    });
    expect(survey).toMatchObject({ status: 'draft', language: 'de', notes: ['note'] });
    expect(survey.assignments).toEqual([
      { name: 'cell', values: ['A', 'B'], pick: 1, stratifyBy: [] },
    ]);
    expect(survey.blocks[0]?.displayLogic).toEqual({
      assignment: 'cell',
      op: 'equals',
      value: 'A',
    });
    expect(survey.questions.map((q) => q.notes)).toEqual([['PROG note'], ['PROG note']]);
    expect(survey.quotaCells[0]).toMatchObject({ kind: 'minimum', target: 50, currentCount: 0 });
    expect(await db.screeningRule.count({ where: { question: { surveyId } } })).toBe(2);
  });

  it('replaces the survey on re-import', async () => {
    await run(definition('Zweite Fassung', 3));
    const survey = await db.survey.findUniqueOrThrow({
      where: { id: surveyId },
      include: { questions: true },
    });
    expect(survey.title).toBe('Zweite Fassung');
    expect(survey.questions).toHaveLength(3);
  });

  it('refuses to replace a survey that has respondents', async () => {
    await db.respondent.create({ data: { surveyId, panelRespondentId: 'TEST-1' } });
    await expect(run(definition('Dritte Fassung', 1))).rejects.toBeInstanceOf(
      SurveyHasRespondentsError,
    );
    expect((await db.survey.findUniqueOrThrow({ where: { id: surveyId } })).title).toBe(
      'Zweite Fassung',
    );
    await db.respondent.deleteMany({ where: { surveyId } });
  });
});
