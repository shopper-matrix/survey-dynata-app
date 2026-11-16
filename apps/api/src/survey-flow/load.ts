import {
  assignmentSchema,
  conditionSchema,
  questionTranslationsSchema,
  surveyTranslationsSchema,
  type AnswerValue,
} from '@survey-dynata/shared';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import { z } from 'zod';
import type { FlowSurvey, RespondentState } from './types.js';

/** The main language first, then every language the survey has a translation for. */
export function surveyLanguages(main: string, translations: unknown): string[] {
  const added = Object.keys(surveyTranslationsSchema.parse(translations ?? {}));
  return [main, ...added.filter((language) => language !== main)];
}

const condition = (value: unknown) => (value === null ? null : conditionSchema.parse(value));

export async function loadFlowSurvey(db: PrismaClient, surveyId: string): Promise<FlowSurvey> {
  const survey = await db.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: {
      id: true,
      language: true,
      translations: true,
      assignments: true,
      blocks: {
        orderBy: { position: 'asc' },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { screeningRules: { select: { condition: true } } },
          },
        },
      },
    },
  });
  return {
    id: survey.id,
    language: survey.language,
    languages: surveyLanguages(survey.language, survey.translations),
    assignments: z.array(assignmentSchema).parse(survey.assignments),
    blocks: survey.blocks.map((block) => ({
      code: block.code,
      rotationGroup: block.rotationGroup,
      displayLogic: condition(block.displayLogic),
      questions: block.questions.map((question) => ({
        id: question.id,
        code: question.code,
        type: question.type,
        text: question.text,
        config: question.config as Record<string, unknown>,
        isScreener: question.isScreener,
        displayLogic: condition(question.displayLogic),
        screenOutRules: question.screeningRules.map((rule) =>
          conditionSchema.parse(rule.condition),
        ),
        translations: questionTranslationsSchema.parse(question.translations),
      })),
    })),
  };
}

export async function loadRespondentState(
  db: PrismaClient,
  respondent: { id: string; assignments: unknown; language?: string | null },
): Promise<RespondentState> {
  const answers = await db.answer.findMany({
    where: { respondentId: respondent.id },
    select: { value: true, question: { select: { code: true } } },
  });
  return {
    respondentId: respondent.id,
    answers: new Map(answers.map((answer) => [answer.question.code, answer.value as AnswerValue])),
    assignments: { ...(respondent.assignments as Record<string, unknown>) },
    language: respondent.language ?? null,
  };
}
