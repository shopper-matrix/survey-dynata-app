import {
  assignmentSchema,
  blockDefinitionSchema,
  conditionSchema,
  questionDefinitionSchema,
  quotaDefinitionSchema,
} from '@survey-dynata/shared';
import { SurveyStatus } from '@survey-dynata/shared/db';
import { Prisma, type PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  assertSurveyValid,
  exportDefinition,
  InvalidSurveyError,
} from '../admin-surveys/definition.js';
import { audit } from '../admin/audit.js';
import { adminOf, requireAdmin } from '../admin/auth.js';
import { withoutUndefined } from '../lib/without-undefined.js';

// Admin CRUD for surveys, blocks, questions (incl. screening rules) and quotas. Every change
// runs in a transaction and is rolled back if the survey would no longer pass the definition
// rules (e.g. a condition pointing at a deleted question).

const json = (value: unknown) => value as Prisma.InputJsonValue;

/** Allowed status changes (pausing a live survey is a separate switch). */
const TRANSITIONS: Record<SurveyStatus, SurveyStatus[]> = {
  draft: ['test'],
  test: ['draft', 'live'],
  live: ['closed'],
  closed: [],
};

const newSurveySchema = z.strictObject({
  title: z.string().min(1).max(200),
  language: z.string().min(2).max(10).default('de'),
  targetCompletes: z.int().min(1),
});

const surveyPatchSchema = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  language: z.string().min(2).max(10).optional(),
  targetCompletes: z.int().min(1).optional(),
  status: z.enum(SurveyStatus).optional(),
  notes: z.array(z.string().min(1)).optional(),
  assignments: z.array(assignmentSchema).optional(),
});

const blockPatchSchema = blockDefinitionSchema.omit({ code: true, questions: true }).partial();
const codesSchema = z.strictObject({ codes: z.array(z.string().min(1)).min(1) });
const questionBodySchema = z.strictObject({
  blockCode: z.string().min(1),
  question: questionDefinitionSchema,
});

const surveyParams = z.object({ id: z.uuid() });
const codeParams = surveyParams.extend({ code: z.string().min(1) });

export function registerAdminSurveyRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; idleMinutes: number },
): void {
  const { db, idleMinutes } = options;
  const viewer = { preHandler: requireAdmin(db, 'viewer', idleMinutes) };
  const editor = { preHandler: requireAdmin(db, 'editor', idleMinutes) };
  const owner = { preHandler: requireAdmin(db, 'owner', idleMinutes) };

  const fail = (reply: FastifyReply, status: number, error: string, details?: unknown) =>
    reply.code(status).send({ error, ...(details === undefined ? {} : { details }) });

  /**
   * Applies a change to one survey: checks it exists, asks for confirmation before screeners
   * or quotas of a live survey change, validates the result, audits it and returns the survey.
   */
  async function mutate(
    request: FastifyRequest,
    reply: FastifyReply,
    action: string,
    change: (tx: Prisma.TransactionClient, surveyId: string) => Promise<unknown>,
    options: { touchesScreeningOrQuotas?: boolean } = {},
  ) {
    const params = surveyParams.safeParse(request.params);
    const survey = params.success
      ? await db.survey.findUnique({
          where: { id: params.data.id },
          select: { id: true, status: true },
        })
      : null;
    if (!survey) return fail(reply, 404, 'survey_not_found');

    const confirmed = (request.query as { confirm?: string }).confirm === 'true';
    if (survey.status === 'live' && options.touchesScreeningOrQuotas && !confirmed) {
      return fail(reply, 409, 'confirmation_required', {
        message:
          'This survey is live. Repeat the request with ?confirm=true to change screeners or quotas.',
      });
    }

    try {
      await db.$transaction(async (tx) => {
        await change(tx, survey.id);
        await assertSurveyValid(tx, survey.id);
      });
    } catch (error) {
      if (error instanceof InvalidSurveyError)
        return fail(reply, 400, 'invalid_survey', error.issues);
      if (error instanceof HttpError) return fail(reply, error.status, error.code);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return fail(reply, 409, 'duplicate');
        if (error.code === 'P2025') return fail(reply, 404, 'not_found');
        if (error.code === 'P2003') return fail(reply, 409, 'in_use');
      }
      throw error;
    }
    await audit(db, adminOf(request).id, action, survey.id, { confirmed });
    return surveyDetails(survey.id);
  }

  async function surveyDetails(surveyId: string) {
    const survey = await db.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: { status: true, updatedAt: true, _count: { select: { respondents: true } } },
    });
    return {
      status: survey.status,
      updatedAt: survey.updatedAt,
      respondents: survey._count.respondents,
      definition: await db.$transaction((tx) => exportDefinition(tx, surveyId)),
    };
  }

  // ---- Surveys -----------------------------------------------------------------------------

  app.get('/api/admin/surveys', viewer, async () => {
    const surveys = await db.survey.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, status: true, targetCompletes: true, updatedAt: true },
    });
    const completes = await db.respondent.groupBy({
      by: ['surveyId'],
      where: { status: 'complete', isTest: false },
      _count: true,
    });
    const count = new Map(completes.map((row) => [row.surveyId, row._count]));
    return surveys.map((survey) => ({ ...survey, completes: count.get(survey.id) ?? 0 }));
  });

  app.post('/api/admin/surveys', editor, async (request, reply) => {
    const body = newSurveySchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);
    const survey = await db.survey.create({
      data: { ...body.data, blocks: { create: { code: 'A', title: 'Teil A', position: 0 } } },
    });
    await audit(db, adminOf(request).id, 'survey_created', survey.id);
    return reply.code(201).send({ id: survey.id, ...(await surveyDetails(survey.id)) });
  });

  app.get('/api/admin/surveys/:id', viewer, async (request, reply) => {
    const params = surveyParams.safeParse(request.params);
    const exists = params.success && (await db.survey.count({ where: { id: params.data.id } })) > 0;
    if (!params.success || !exists) return fail(reply, 404, 'survey_not_found');
    return surveyDetails(params.data.id);
  });

  app.patch('/api/admin/surveys/:id', editor, async (request, reply) => {
    const body = surveyPatchSchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);
    const { assignments, ...data } = body.data;
    return mutate(request, reply, 'survey_updated', async (tx, surveyId) => {
      const current = await tx.survey.findUniqueOrThrow({ where: { id: surveyId } });
      if (
        data.status &&
        data.status !== current.status &&
        !TRANSITIONS[current.status].includes(data.status)
      ) {
        throw new HttpError(409, `status_change_not_allowed`);
      }
      await tx.survey.update({
        where: { id: surveyId },
        data: {
          ...withoutUndefined(data),
          ...(assignments ? { assignments: json(assignments) } : {}),
        },
      });
    });
  });

  app.delete('/api/admin/surveys/:id', owner, async (request, reply) => {
    const params = surveyParams.safeParse(request.params);
    if (!params.success) return fail(reply, 404, 'survey_not_found');
    if ((await db.respondent.count({ where: { surveyId: params.data.id } })) > 0) {
      return fail(reply, 409, 'has_respondents');
    }
    const deleted = await db.survey.deleteMany({ where: { id: params.data.id } });
    if (deleted.count === 0) return fail(reply, 404, 'survey_not_found');
    await audit(db, adminOf(request).id, 'survey_deleted', params.data.id);
    return { ok: true };
  });

  // ---- Blocks ------------------------------------------------------------------------------

  app.post('/api/admin/surveys/:id/blocks', editor, async (request, reply) => {
    const body = blockDefinitionSchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);
    return mutate(request, reply, 'block_created', async (tx, surveyId) => {
      const last = await tx.block.aggregate({ where: { surveyId }, _max: { position: true } });
      await tx.block.create({
        data: {
          surveyId,
          code: body.data.code,
          title: body.data.title,
          position: (last._max.position ?? -1) + 1,
          rotationGroup: body.data.rotationGroup ?? null,
          ...(body.data.displayLogic ? { displayLogic: json(body.data.displayLogic) } : {}),
        },
      });
    });
  });

  app.patch('/api/admin/surveys/:id/blocks/:code', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    const body = blockPatchSchema.safeParse(request.body);
    if (!params.success || !body.success) return fail(reply, 400, 'invalid_request');
    return mutate(request, reply, 'block_updated', async (tx, surveyId) => {
      const { displayLogic, ...rest } = body.data;
      await tx.block.update({
        where: { surveyId_code: { surveyId, code: params.data.code } },
        data: {
          ...withoutUndefined(rest),
          ...(displayLogic === undefined ? {} : { displayLogic: json(displayLogic) }),
        },
      });
    });
  });

  app.delete('/api/admin/surveys/:id/blocks/:code', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    if (!params.success) return fail(reply, 400, 'invalid_request');
    return mutate(request, reply, 'block_deleted', async (tx, surveyId) => {
      const block = await tx.block.findUniqueOrThrow({
        where: { surveyId_code: { surveyId, code: params.data.code } },
        include: { _count: { select: { questions: true } } },
      });
      if (block._count.questions > 0) throw new HttpError(409, 'block_not_empty');
      await tx.block.delete({ where: { id: block.id } });
    });
  });

  app.post('/api/admin/surveys/:id/blocks/reorder', editor, async (request, reply) => {
    const body = codesSchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);
    return mutate(request, reply, 'blocks_reordered', async (tx, surveyId) => {
      const blocks = await tx.block.findMany({
        where: { surveyId },
        select: { id: true, code: true },
      });
      await reorder(tx, 'block', blocks, body.data.codes);
    });
  });

  // ---- Questions (incl. screening rule) --------------------------------------------------

  const touchesScreening = (q: { isScreener?: boolean; screenOut?: unknown }) =>
    q.isScreener === true || q.screenOut !== undefined;

  app.post('/api/admin/surveys/:id/questions', editor, async (request, reply) => {
    const body = questionBodySchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);
    const { blockCode, question } = body.data;
    return mutate(
      request,
      reply,
      'question_created',
      async (tx, surveyId) => {
        const block = await tx.block.findUniqueOrThrow({
          where: { surveyId_code: { surveyId, code: blockCode } },
        });
        const last = await tx.question.aggregate({
          where: { blockId: block.id },
          _max: { position: true },
        });
        await writeQuestion(tx, surveyId, block.id, (last._max.position ?? -1) + 1, question);
      },
      { touchesScreeningOrQuotas: touchesScreening(question) },
    );
  });

  app.put('/api/admin/surveys/:id/questions/:code', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    const body = questionBodySchema.safeParse(request.body);
    if (!params.success || !body.success)
      return fail(reply, 400, 'invalid_request', body.success ? undefined : body.error.issues);
    const { blockCode, question } = body.data;
    const existing = await db.question.findFirst({
      where: { surveyId: params.data.id, code: params.data.code },
      include: { _count: { select: { screeningRules: true } } },
    });
    if (!existing) return fail(reply, 404, 'question_not_found');
    return mutate(
      request,
      reply,
      'question_updated',
      async (tx, surveyId) => {
        const block = await tx.block.findUniqueOrThrow({
          where: { surveyId_code: { surveyId, code: blockCode } },
        });
        const position =
          block.id === existing.blockId
            ? existing.position
            : ((
                await tx.question.aggregate({
                  where: { blockId: block.id },
                  _max: { position: true },
                })
              )._max.position ?? -1) + 1;
        await tx.screeningRule.deleteMany({ where: { questionId: existing.id } });
        await writeQuestion(tx, surveyId, block.id, position, question, existing.id);
      },
      {
        touchesScreeningOrQuotas:
          existing.isScreener || existing._count.screeningRules > 0 || touchesScreening(question),
      },
    );
  });

  app.delete('/api/admin/surveys/:id/questions/:code', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    if (!params.success) return fail(reply, 400, 'invalid_request');
    const existing = await db.question.findFirst({
      where: { surveyId: params.data.id, code: params.data.code },
      include: { _count: { select: { answers: true } } },
    });
    if (!existing) return fail(reply, 404, 'question_not_found');
    if (existing._count.answers > 0) return fail(reply, 409, 'question_has_answers');
    return mutate(
      request,
      reply,
      'question_deleted',
      async (tx) => {
        await tx.question.delete({ where: { id: existing.id } });
      },
      { touchesScreeningOrQuotas: existing.isScreener },
    );
  });

  app.post('/api/admin/surveys/:id/blocks/:code/reorder', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    const body = codesSchema.safeParse(request.body);
    if (!params.success || !body.success) return fail(reply, 400, 'invalid_request');
    return mutate(request, reply, 'questions_reordered', async (tx, surveyId) => {
      const block = await tx.block.findUniqueOrThrow({
        where: { surveyId_code: { surveyId, code: params.data.code } },
        include: { questions: { select: { id: true, code: true } } },
      });
      await reorder(tx, 'question', block.questions, body.data.codes);
    });
  });

  // ---- Quotas ------------------------------------------------------------------------------

  app.post('/api/admin/surveys/:id/quotas', editor, async (request, reply) => {
    const body = quotaDefinitionSchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);
    return mutate(
      request,
      reply,
      'quota_created',
      async (tx, surveyId) => {
        await tx.quotaCell.create({
          data: { surveyId, ...body.data, conditions: json(body.data.conditions) },
        });
      },
      { touchesScreeningOrQuotas: true },
    );
  });

  app.put('/api/admin/surveys/:id/quotas/:code', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    const body = quotaDefinitionSchema.safeParse(request.body);
    if (!params.success || !body.success) return fail(reply, 400, 'invalid_request');
    return mutate(
      request,
      reply,
      'quota_updated',
      async (tx, surveyId) => {
        await tx.quotaCell.update({
          where: { surveyId_name: { surveyId, name: params.data.code } },
          data: { ...body.data, conditions: json(body.data.conditions) },
        });
      },
      { touchesScreeningOrQuotas: true },
    );
  });

  app.delete('/api/admin/surveys/:id/quotas/:code', editor, async (request, reply) => {
    const params = codeParams.safeParse(request.params);
    if (!params.success) return fail(reply, 400, 'invalid_request');
    return mutate(
      request,
      reply,
      'quota_deleted',
      async (tx, surveyId) => {
        await tx.quotaCell.delete({
          where: { surveyId_name: { surveyId, name: params.data.code } },
        });
      },
      { touchesScreeningOrQuotas: true },
    );
  });
}

/** A request-level error raised inside a change (mapped to its status code). */
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function writeQuestion(
  tx: Prisma.TransactionClient,
  surveyId: string,
  blockId: string,
  position: number,
  question: z.output<typeof questionDefinitionSchema>,
  existingId?: string,
): Promise<void> {
  const data = {
    surveyId,
    blockId,
    position,
    code: question.code,
    type: question.type,
    text: question.text,
    config: json(question.config),
    isScreener: question.isScreener,
    isAttentionCheck: question.isAttentionCheck,
    notes: question.notes,
    displayLogic: question.displayLogic ? json(question.displayLogic) : Prisma.DbNull,
  };
  const saved = existingId
    ? await tx.question.update({ where: { id: existingId }, data })
    : await tx.question.create({ data });
  if (question.screenOut) {
    await tx.screeningRule.create({
      data: { questionId: saved.id, condition: json(conditionSchema.parse(question.screenOut)) },
    });
  }
}

/** Sets positions to the given code order; every existing item must be listed exactly once. */
async function reorder(
  tx: Prisma.TransactionClient,
  model: 'block' | 'question',
  items: { id: string; code: string }[],
  codes: string[],
): Promise<void> {
  const byCode = new Map(items.map((item) => [item.code, item.id]));
  if (
    codes.length !== items.length ||
    new Set(codes).size !== codes.length ||
    codes.some((c) => !byCode.has(c))
  ) {
    throw new HttpError(400, 'order_must_list_every_item_once');
  }
  // Two passes keep the unique (parent, position) index satisfied while moving.
  for (const [index, code] of codes.entries()) {
    const where = { id: byCode.get(code) ?? '' };
    if (model === 'block') await tx.block.update({ where, data: { position: -1 - index } });
    else await tx.question.update({ where, data: { position: -1 - index } });
  }
  for (const [index, code] of codes.entries()) {
    const where = { id: byCode.get(code) ?? '' };
    if (model === 'block') await tx.block.update({ where, data: { position: index } });
    else await tx.question.update({ where, data: { position: index } });
  }
}
