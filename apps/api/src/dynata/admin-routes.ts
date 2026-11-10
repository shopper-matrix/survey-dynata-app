import { Prisma } from '@survey-dynata/shared/db/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../admin/audit.js';
import { adminOf } from '../admin/auth.js';
import type { AdminRouteOptions } from '../providers/sample-provider.js';
import type { DynataConfig } from './config.js';

const params = z.object({ id: z.uuid() });
const body = z.strictObject({ projectId: z.string().trim().min(1).max(100) });

/**
 * Per-survey Dynata settings for the admin area. Only the project ID is stored per survey; the
 * key ID and secret are per client and come from the environment (never shown or edited here).
 */
export function registerDynataAdminRoutes(
  app: FastifyInstance,
  { db, editor, viewer }: AdminRouteOptions,
  config: DynataConfig,
): void {
  app.get('/api/admin/surveys/:id/dynata', { preHandler: viewer }, async (request, reply) => {
    const survey = params.safeParse(request.params);
    if (!survey.success) return reply.code(400).send({ error: 'invalid_request' });
    const settings = await db.dynataSurveySettings.findUnique({
      where: { surveyId: survey.data.id },
    });
    return {
      projectId: settings?.projectId ?? null,
      mode: config.mode,
      keyConfigured: config.mode === 'live',
    };
  });

  app.put('/api/admin/surveys/:id/dynata', { preHandler: editor }, async (request, reply) => {
    const survey = params.safeParse(request.params);
    const input = body.safeParse(request.body);
    if (!survey.success || !input.success)
      return reply.code(400).send({ error: 'invalid_request' });
    try {
      await db.dynataSurveySettings.upsert({
        where: { surveyId: survey.data.id },
        create: { surveyId: survey.data.id, projectId: input.data.projectId },
        update: { projectId: input.data.projectId },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return reply.code(409).send({ error: 'project_in_use' });
        if (error.code === 'P2003') return reply.code(404).send({ error: 'survey_not_found' });
      }
      throw error;
    }
    await audit(db, adminOf(request).id, 'dynata_settings_updated', survey.data.id, input.data);
    return {
      projectId: input.data.projectId,
      mode: config.mode,
      keyConfigured: config.mode === 'live',
    };
  });
}
