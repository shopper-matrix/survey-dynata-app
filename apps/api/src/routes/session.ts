import { answerSchema, type AnswerValue } from '@survey-dynata/shared';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { respondentIdFromSession } from '../http/session.js';
import type { SampleProvider } from '../providers/sample-provider.js';
import { inFullQuota } from '../quotas/quotas.js';
import { failsScreening } from '../screening/screening.js';
import { endSession, storedSessionEnd, type OutcomeHook } from '../session/end-session.js';
import { loadFlowSurvey, loadRespondentState } from '../survey-flow/load.js';
import type { FlowStep } from '../survey-flow/next-screen.js';
import { presentQuestion } from '../survey-flow/present.js';
import { resolveWalk } from '../survey-flow/resolve.js';
import type { FlowQuestion, RespondentState } from '../survey-flow/types.js';

// Respondent session API: the server decides what comes next and how the session ends; the
// browser only shows screens and follows the returned redirect.

const answerBodySchema = z.strictObject({
  questionCode: z.string().min(1),
  value: z.unknown(),
  responseTimeMs: z
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000)
    .optional(),
});

export interface SessionRouteOptions {
  db: PrismaClient;
  provider: SampleProvider;
  /** Runs when a session ends, before the outcome is stored (quotas, quality checks). */
  beforeEnd?: OutcomeHook;
}

function screenResponse(step: FlowStep) {
  if (step.kind === 'screen') {
    return { done: false, question: step.question, progress: step.progress };
  }
  return { done: true };
}

const fail = (reply: FastifyReply, status: number, error: string, details?: unknown) =>
  reply.code(status).send({ error, ...(details === undefined ? {} : { details }) });

const conditionContext = (state: RespondentState) => ({
  answer: (code: string) => state.answers.get(code),
  assignment: (name: string) => state.assignments[name] as string | string[] | undefined,
});

export function registerSessionRoutes(app: FastifyInstance, options: SessionRouteOptions): void {
  const { db, provider, beforeEnd } = options;

  async function sessionRespondent(request: FastifyRequest) {
    const respondentId = respondentIdFromSession(request);
    return respondentId
      ? db.respondent.findUnique({
          where: { id: respondentId },
          select: { id: true, surveyId: true, status: true, assignments: true },
        })
      : null;
  }

  /** A finished respondent gets the same redirect again (refresh, back button). */
  async function finished(reply: FastifyReply, respondentId: string) {
    const end = await storedSessionEnd(db, respondentId);
    return end ? { done: true, ...end } : fail(reply, 409, 'finished');
  }

  app.get('/api/session/questions', async (request, reply) => {
    const respondent = await sessionRespondent(request);
    if (!respondent) return fail(reply, 401, 'no_session');
    if (respondent.status !== 'started') return finished(reply, respondent.id);

    const survey = await loadFlowSurvey(db, respondent.surveyId);
    const walk = await resolveWalk(db, survey, await loadRespondentState(db, respondent));
    return screenResponse(walk.step);
  });

  app.post('/api/session/answers', async (request, reply) => {
    const respondent = await sessionRespondent(request);
    if (!respondent) return fail(reply, 401, 'no_session');
    if (respondent.status !== 'started') return fail(reply, 409, 'finished');

    const body = answerBodySchema.safeParse(request.body);
    if (!body.success) return fail(reply, 400, 'invalid_request', body.error.issues);

    const survey = await loadFlowSurvey(db, respondent.surveyId);
    const state = await loadRespondentState(db, respondent);
    const questions = new Map<string, FlowQuestion>(
      survey.blocks.flatMap((block) => block.questions.map((q) => [q.code, q])),
    );
    const question = questions.get(body.data.questionCode);
    if (!question) return fail(reply, 404, 'unknown_question');

    // Validate against what this respondent is shown (piped options, assigned stimulus).
    const walk = await resolveWalk(db, survey, state);
    let config: Record<string, unknown>;
    if (walk.step.kind === 'screen' && walk.step.question.code === question.code) {
      config = walk.step.question.config;
    } else {
      // Only earlier, still visible answers may change, and never a screener's.
      if (!walk.answeredVisible.has(question.code)) return fail(reply, 409, 'not_current');
      if (question.isScreener) return fail(reply, 409, 'screener_locked');
      const presented = presentQuestion(question, state, questions);
      if (presented.kind !== 'question') return fail(reply, 409, 'not_current');
      config = presented.question.config;
    }
    const value = answerSchema(question.type, config).safeParse(body.data.value);
    if (!value.success) return fail(reply, 400, 'invalid_answer', value.error.issues);

    const data = {
      value: value.data as Prisma.InputJsonValue,
      responseTimeMs: body.data.responseTimeMs ?? null,
      answeredAt: new Date(),
    };
    await db.answer.upsert({
      where: { respondentId_questionId: { respondentId: respondent.id, questionId: question.id } },
      create: { respondentId: respondent.id, questionId: question.id, ...data },
      update: data,
    });
    state.answers.set(question.code, value.data as AnswerValue);

    const ctx = conditionContext(state);
    if (failsScreening(question.screenOutRules, ctx)) {
      return { done: true, ...(await endSession(db, provider, respondent.id, 'screenout')) };
    }
    if (await inFullQuota(db, respondent.surveyId, ctx)) {
      return { done: true, ...(await endSession(db, provider, respondent.id, 'overquota')) };
    }
    return screenResponse((await resolveWalk(db, survey, state)).step);
  });

  /** Ends a respondent who answered everything; idempotent (same link on every call). */
  app.post('/api/session/finish', async (request, reply) => {
    const respondent = await sessionRespondent(request);
    if (!respondent) return fail(reply, 401, 'no_session');
    if (respondent.status !== 'started') return finished(reply, respondent.id);

    const survey = await loadFlowSurvey(db, respondent.surveyId);
    const walk = await resolveWalk(db, survey, await loadRespondentState(db, respondent));
    if (walk.step.kind !== 'done') return fail(reply, 409, 'not_finished');

    return {
      done: true,
      ...(await endSession(db, provider, respondent.id, 'complete', beforeEnd)),
    };
  });
}
