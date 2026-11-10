import { assignmentSchema, type AnswerValue } from '@survey-dynata/shared';
import type { RespondentStatus } from '@survey-dynata/shared/db';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import { z } from 'zod';
import type { ExportQuestion, ExportRow } from './columns.js';

export interface ExportFilters {
  statuses?: RespondentStatus[];
  /** Respondents who started on or after this time. */
  from?: Date;
  /** Respondents who started before this time. */
  to?: Date;
  includeTest: boolean;
}

export interface ExportData {
  title: string;
  questions: ExportQuestion[];
  assignmentNames: string[];
  rows: ExportRow[];
}

export async function loadExportData(
  db: PrismaClient,
  surveyId: string,
  filters: ExportFilters,
): Promise<ExportData> {
  const survey = await db.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: {
      title: true,
      assignments: true,
      blocks: {
        orderBy: { position: 'asc' },
        select: {
          questions: {
            orderBy: { position: 'asc' },
            select: { code: true, type: true, text: true, config: true },
          },
        },
      },
    },
  });

  const respondents = await db.respondent.findMany({
    where: {
      surveyId,
      ...(filters.includeTest ? {} : { isTest: false }),
      ...(filters.statuses?.length ? { status: { in: filters.statuses } } : {}),
      ...(filters.from || filters.to
        ? {
            startedAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lt: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: 'asc' },
    include: {
      answers: {
        select: { value: true, responseTimeMs: true, question: { select: { code: true } } },
      },
    },
  });

  return {
    title: survey.title,
    questions: survey.blocks.flatMap((block) =>
      block.questions.map((q) => ({ ...q, config: q.config as Record<string, unknown> })),
    ),
    assignmentNames: z
      .array(assignmentSchema)
      .parse(survey.assignments)
      .map((assignment) => assignment.name),
    rows: respondents.map((r) => ({
      id: r.id,
      panelRespondentId: r.panelRespondentId,
      status: r.status,
      isTest: r.isTest,
      deviceType: r.deviceType,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      qualityFlags: Array.isArray(r.qualityFlags) ? r.qualityFlags.map(String) : [],
      assignments: r.assignments as Record<string, unknown>,
      answers: new Map(
        r.answers.map((a) => [
          a.question.code,
          { value: a.value as AnswerValue, responseTimeMs: a.responseTimeMs },
        ]),
      ),
    })),
  };
}
