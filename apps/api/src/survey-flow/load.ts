import { assignmentSchema, conditionSchema, type AnswerValue } from '@survey-dynata/shared';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import { z } from 'zod';
import type { FlowSurvey, RespondentState } from './types.js';

const condition = (value: unknown) => (value === null ? null : conditionSchema.parse(value));

export async function loadFlowSurvey(db: PrismaClient, surveyId: string): Promise<FlowSurvey> {
  const survey = await db.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: {
      id: true,
      assignments: true,
      blocks: {
        orderBy: { position: 'asc' },
        include: { questions: { orderBy: { position: 'asc' } } },
      },
    },
  });
  return {
    id: survey.id,
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
      })),
    })),
  };
}

export async function loadRespondentState(
  db: PrismaClient,
  respondent: { id: string; assignments: unknown },
): Promise<RespondentState> {
  const answers = await db.answer.findMany({
    where: { respondentId: respondent.id },
    select: { value: true, question: { select: { code: true } } },
  });
  return {
    respondentId: respondent.id,
    answers: new Map(answers.map((answer) => [answer.question.code, answer.value as AnswerValue])),
    assignments: { ...(respondent.assignments as Record<string, unknown>) },
  };
}
