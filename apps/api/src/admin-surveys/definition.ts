import {
  surveyDefinitionSchema,
  type AttentionAnswer,
  type Condition,
  type QualitySettingsInput,
  type QuestionTranslations,
  type SurveyDefinitionInput,
  type SurveyTranslations,
} from '@survey-dynata/shared';
import type { Prisma } from '@survey-dynata/shared/db/client';
import type { z } from 'zod';

// A stored survey in the import format, so every admin change can be checked with the same
// rules as an imported file.

export class InvalidSurveyError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('The change would leave the survey invalid');
    this.name = 'InvalidSurveyError';
  }
}

export async function exportDefinition(
  tx: Prisma.TransactionClient,
  surveyId: string,
): Promise<SurveyDefinitionInput> {
  const survey = await tx.survey.findUniqueOrThrow({
    where: { id: surveyId },
    include: {
      blocks: {
        orderBy: { position: 'asc' },
        include: {
          questions: { orderBy: { position: 'asc' }, include: { screeningRules: true } },
        },
      },
      quotaCells: { orderBy: { name: 'asc' } },
    },
  });
  const condition = (value: unknown) =>
    value === null ? {} : { displayLogic: value as Condition };

  return {
    survey: {
      id: survey.id,
      title: survey.title,
      language: survey.language,
      targetCompletes: survey.targetCompletes,
      notes: survey.notes,
      ...(survey.intro ? { intro: survey.intro } : {}),
      ...(survey.estimatedMinutes ? { estimatedMinutes: survey.estimatedMinutes } : {}),
      ...(survey.privacyNotice ? { privacyNotice: survey.privacyNotice } : {}),
      ...(survey.privacyPolicyUrl ? { privacyPolicyUrl: survey.privacyPolicyUrl } : {}),
      translations: survey.translations as SurveyTranslations,
      quality: survey.qualitySettings as QualitySettingsInput,
      ...(survey.retentionDays ? { retentionDays: survey.retentionDays } : {}),
    },
    assignments: survey.assignments as SurveyDefinitionInput['assignments'],
    blocks: survey.blocks.map((block) => ({
      code: block.code,
      title: block.title,
      ...(block.rotationGroup ? { rotationGroup: block.rotationGroup } : {}),
      ...condition(block.displayLogic),
      questions: block.questions.map((question) => ({
        code: question.code,
        type: question.type,
        text: question.text,
        config: question.config,
        isScreener: question.isScreener,
        isAttentionCheck: question.isAttentionCheck,
        ...(question.attentionAnswer === null
          ? {}
          : { attentionAnswer: question.attentionAnswer as AttentionAnswer }),
        notes: question.notes,
        translations: question.translations as QuestionTranslations,
        ...condition(question.displayLogic),
        // The import format holds one screen-out condition per question.
        ...(question.screeningRules[0]
          ? { screenOut: question.screeningRules[0].condition as Condition }
          : {}),
      })),
    })),
    quotas: survey.quotaCells.map((cell) => ({
      name: cell.name,
      conditions: cell.conditions as Condition,
      target: cell.target,
      kind: cell.kind,
    })),
  };
}

/** Throws InvalidSurveyError if the stored survey no longer passes the definition rules. */
export async function assertSurveyValid(
  tx: Prisma.TransactionClient,
  surveyId: string,
): Promise<void> {
  const result = surveyDefinitionSchema.safeParse(await exportDefinition(tx, surveyId));
  if (!result.success) throw new InvalidSurveyError(result.error.issues);
}
