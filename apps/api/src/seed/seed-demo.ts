import { conditionSchema, parseQuestionConfig } from '@survey-dynata/shared';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import { buildDemoRespondents } from './demo-respondents.js';
import { DEMO_SURVEY_ID, demoBlocks, demoQuotaCells, demoSurvey } from './demo-survey.js';

export interface SeedSummary {
  questions: number;
  respondents: number;
  answers: number;
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Replaces the demo survey and its respondents. Safe to run repeatedly. */
export async function seedDemo(db: PrismaClient): Promise<SeedSummary> {
  const respondents = buildDemoRespondents();
  const completes = respondents.filter((respondent) => respondent.status === 'complete');

  return db.$transaction(
    async (tx) => {
      // Answers restrict question deletion, so remove them before cascading from the survey.
      await tx.answer.deleteMany({ where: { respondent: { surveyId: DEMO_SURVEY_ID } } });
      await tx.survey.deleteMany({ where: { id: DEMO_SURVEY_ID } });

      await tx.survey.create({ data: demoSurvey });

      const blocks = await tx.block.createManyAndReturn({
        data: demoBlocks.map((block, position) => ({
          surveyId: DEMO_SURVEY_ID,
          code: block.code,
          title: block.title,
          position,
          rotationGroup: block.rotationGroup ?? null,
        })),
      });
      const blockId = new Map(blocks.map((block) => [block.code, block.id]));

      const questions = await tx.question.createManyAndReturn({
        data: demoBlocks.flatMap((block) =>
          block.questions.map((question, position) => ({
            surveyId: DEMO_SURVEY_ID,
            blockId: blockId.get(block.code) ?? '',
            code: question.code,
            position,
            type: question.type,
            text: question.text,
            // Store the validated config, with defaults filled in.
            config: json(parseQuestionConfig(question.type, question.config)),
            isScreener: question.isScreener ?? false,
            isAttentionCheck: question.isAttentionCheck ?? false,
          })),
        ),
      });
      const questionId = new Map(questions.map((question) => [question.code, question.id]));

      await tx.screeningRule.createMany({
        data: demoBlocks.flatMap((block) =>
          block.questions.flatMap((question) =>
            question.screenOut
              ? [
                  {
                    questionId: questionId.get(question.code) ?? '',
                    condition: json(conditionSchema.parse(question.screenOut)),
                  },
                ]
              : [],
          ),
        ),
      });

      await tx.quotaCell.createMany({
        data: demoQuotaCells.map((cell) => ({
          surveyId: DEMO_SURVEY_ID,
          name: cell.name,
          conditions: json(conditionSchema.parse(cell.conditions)),
          target: cell.target,
          currentCount: completes.filter((respondent) =>
            respondent.answers.some(
              (answer) =>
                answer.questionCode === cell.conditions.question &&
                answer.value.optionId === cell.conditions.value,
            ),
          ).length,
        })),
      });

      const created = await tx.respondent.createManyAndReturn({
        data: respondents.map((respondent) => ({
          surveyId: DEMO_SURVEY_ID,
          panelRespondentId: respondent.panelRespondentId,
          status: respondent.status,
          deviceType: respondent.deviceType,
          startedAt: respondent.startedAt,
          endedAt: respondent.endedAt,
          qualityFlags: json(respondent.qualityFlags),
          assignments: json(respondent.assignments),
        })),
      });
      const respondentId = new Map(created.map((row) => [row.panelRespondentId, row.id]));

      const answers = respondents.flatMap((respondent) =>
        respondent.answers.map((answer) => ({
          respondentId: respondentId.get(respondent.panelRespondentId) ?? '',
          questionId: questionId.get(answer.questionCode) ?? '',
          value: json(answer.value),
          responseTimeMs: answer.responseTimeMs,
          answeredAt: answer.answeredAt,
        })),
      );
      await tx.answer.createMany({ data: answers });

      return { questions: questions.length, respondents: created.length, answers: answers.length };
    },
    { timeout: 30_000 },
  );
}
