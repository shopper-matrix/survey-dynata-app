import { answerSchema, type AnswerValue } from '@survey-dynata/shared';
import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { respondentIdFromSession } from '../http/session.js';
import { failsScreening } from '../screening/screening.js';
import { loadFlowSurvey, loadRespondentState } from '../survey-flow/load.js';
import type { FlowStep } from '../survey-flow/next-screen.js';
import { presentQuestion } from '../survey-flow/present.js';
import { resolveWalk } from '../survey-flow/resolve.js';
import type { FlowQuestion } from '../survey-flow/types.js';

// Respondent session API: the server decides what comes next; the browser only shows it.

const answerBodySchema = z.strictObject({
  questionCode: z.string().min(1),
  value: z.unknown(),
  responseTimeMs: z
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000)
    .optional(),
});

function screenResponse(step: FlowStep) {
  if (step.kind === 'screen') {
    return { done: false, question: step.question, progress: step.progress };
  }
  return { done: true };
}

const fail = (reply: FastifyReply, status: number, error: string, details?: unknown) =>
  reply.code(status).send({ error, ...(details === undefined ? {} : { details }) });

export function registerSessionRoutes(app: FastifyInstance, db: PrismaClient): void {
  /** The respondent behind the session cookie, if they may still answer. */
  async function activeRespondent(request: FastifyRequest, reply: FastifyReply) {
    const respondentId = respondentIdFromSession(request);
    const respondent = respondentId
      ? await db.respondent.findUnique({
          where: { id: respondentId },
          select: { id: true, surveyId: true, status: true, assignments: true },
        })
      : null;
    if (!respondent) {
      await fail(reply, 401, 'no_session');
      return null;
    }
    if (respondent.status !== 'started') {
      await fail(reply, 409, 'finished');
      return null;
    }
    return respondent;
  }

  app.get('/api/session/questions', async (request, reply) => {
    const respondent = await activeRespondent(request, reply);
    if (!respondent) return reply;
    const survey = await loadFlowSurvey(db, respondent.surveyId);
    const walk = await resolveWalk(db, survey, await loadRespondentState(db, respondent));
    return screenResponse(walk.step);
  });

  app.post('/api/session/answers', async (request, reply) => {
    const respondent = await activeRespondent(request, reply);
    if (!respondent) return reply;

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

    const ctx = {
      answer: (code: string) => state.answers.get(code),
      assignment: (name: string) => state.assignments[name] as string | string[] | undefined,
    };
    if (failsScreening(question.screenOutRules, ctx)) {
      await db.respondent.update({
        where: { id: respondent.id },
        data: { status: 'screenout', endedAt: new Date() },
      });
      return { done: true, outcome: 'screenout' };
    }

    return screenResponse((await resolveWalk(db, survey, state)).step);
  });
}
