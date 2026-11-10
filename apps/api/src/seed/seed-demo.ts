import { surveyDefinitionSchema } from '@survey-dynata/shared';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import { importSurvey } from '../survey-import/import-survey.js';
import { buildDemoRespondents } from './demo-respondents.js';
import {
  DEMO_DYNATA_PROJECT_ID,
  DEMO_SURVEY_ID,
  demoDefinition,
  demoQuotaCells,
  demoSurvey,
} from './demo-survey.js';

export interface SeedSummary {
  questions: number;
  respondents: number;
  answers: number;
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Replaces the demo survey and its respondents. Safe to run repeatedly. */
export async function seedDemo(db: PrismaClient): Promise<SeedSummary> {
  const definition = surveyDefinitionSchema.parse(demoDefinition);
  const respondents = buildDemoRespondents();
  const completes = respondents.filter((respondent) => respondent.status === 'complete');

  return db.$transaction(
    async (tx) => {
      // Demo respondents are fake, so they may be replaced (the importer never deletes
      // respondents). Answers restrict question deletion, so they go first.
      await tx.answer.deleteMany({ where: { respondent: { surveyId: DEMO_SURVEY_ID } } });
      await tx.respondent.deleteMany({ where: { surveyId: DEMO_SURVEY_ID } });

      const { questionIds, questions } = await importSurvey(tx, definition, {
        status: demoSurvey.status,
      });
      await tx.dynataSurveySettings.create({
        data: { surveyId: DEMO_SURVEY_ID, projectId: DEMO_DYNATA_PROJECT_ID },
      });

      for (const cell of demoQuotaCells) {
        const currentCount = completes.filter((respondent) =>
          respondent.answers.some(
            (answer) =>
              answer.questionCode === cell.conditions.question &&
              answer.value.optionId === cell.conditions.value,
          ),
        ).length;
        await tx.quotaCell.update({
          where: { surveyId_name: { surveyId: DEMO_SURVEY_ID, name: cell.name } },
          data: { currentCount },
        });
      }

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
          questionId: questionIds.get(answer.questionCode) ?? '',
          value: json(answer.value),
          responseTimeMs: answer.responseTimeMs,
          answeredAt: answer.answeredAt,
        })),
      );
      await tx.answer.createMany({ data: answers });

      return { questions, respondents: created.length, answers: answers.length };
    },
    { timeout: 30_000 },
  );
}
