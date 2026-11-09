import type { SurveyDefinition } from '@survey-dynata/shared';
import type { SurveyStatus } from '@survey-dynata/shared/db';
import type { Prisma } from '@survey-dynata/shared/db/client';

export interface ImportResult {
  surveyId: string;
  /** Question ID by question code. */
  questionIds: Map<string, string>;
  questions: number;
}

export class SurveyHasRespondentsError extends Error {
  constructor(readonly surveyId: string) {
    super(`Survey ${surveyId} already has respondents; refusing to replace it.`);
    this.name = 'SurveyHasRespondentsError';
  }
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * Writes a validated survey definition. An existing survey with the same ID is replaced,
 * unless it has respondents (fieldwork data is never overwritten). Run inside a transaction.
 */
export async function importSurvey(
  tx: Prisma.TransactionClient,
  definition: SurveyDefinition,
  options: { status?: SurveyStatus } = {},
): Promise<ImportResult> {
  const { id } = definition.survey;

  if ((await tx.respondent.count({ where: { surveyId: id } })) > 0) {
    throw new SurveyHasRespondentsError(id);
  }
  await tx.survey.deleteMany({ where: { id } });

  await tx.survey.create({
    data: {
      id,
      title: definition.survey.title,
      language: definition.survey.language,
      targetCompletes: definition.survey.targetCompletes,
      status: options.status ?? 'draft',
      notes: definition.survey.notes,
      intro: definition.survey.intro ?? null,
      estimatedMinutes: definition.survey.estimatedMinutes ?? null,
      privacyNotice: definition.survey.privacyNotice ?? null,
      privacyPolicyUrl: definition.survey.privacyPolicyUrl ?? null,
      translations: json(definition.survey.translations),
      assignments: json(definition.assignments),
      qualitySettings: json(definition.survey.quality),
    },
  });

  const blocks = await tx.block.createManyAndReturn({
    data: definition.blocks.map((block, position) => ({
      surveyId: id,
      code: block.code,
      title: block.title,
      position,
      rotationGroup: block.rotationGroup ?? null,
      ...(block.displayLogic ? { displayLogic: json(block.displayLogic) } : {}),
    })),
  });
  const blockIds = new Map(blocks.map((block) => [block.code, block.id]));

  const questions = await tx.question.createManyAndReturn({
    data: definition.blocks.flatMap((block) =>
      block.questions.map((question, position) => ({
        surveyId: id,
        blockId: blockIds.get(block.code) ?? '',
        code: question.code,
        position,
        type: question.type,
        text: question.text,
        config: json(question.config),
        isScreener: question.isScreener,
        isAttentionCheck: question.isAttentionCheck,
        ...(question.attentionAnswer ? { attentionAnswer: json(question.attentionAnswer) } : {}),
        notes: question.notes,
        translations: json(question.translations),
        ...(question.displayLogic ? { displayLogic: json(question.displayLogic) } : {}),
      })),
    ),
  });
  const questionIds = new Map(questions.map((question) => [question.code, question.id]));

  await tx.screeningRule.createMany({
    data: definition.blocks.flatMap((block) =>
      block.questions.flatMap((question) =>
        question.screenOut
          ? [
              {
                questionId: questionIds.get(question.code) ?? '',
                condition: json(question.screenOut),
              },
            ]
          : [],
      ),
    ),
  });

  await tx.quotaCell.createMany({
    data: definition.quotas.map((quota) => ({
      surveyId: id,
      name: quota.name,
      conditions: json(quota.conditions),
      target: quota.target,
      kind: quota.kind,
    })),
  });

  return { surveyId: id, questionIds, questions: questions.length };
}
