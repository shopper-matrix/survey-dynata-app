import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../admin/audit.js';
import { adminOf, requireAdmin } from '../admin/auth.js';
import { surveyEntryUrl } from '../http/entry-url.js';
import type { SampleProvider } from '../providers/sample-provider.js';
import { newTestRespondentId } from '../test-links/test-links.js';

const params = z.object({ id: z.uuid() });
const body = z.strictObject({ count: z.int().min(1).max(50).default(5) });

interface Options {
  db: PrismaClient;
  provider: SampleProvider;
  appBaseUrl: string;
  idleMinutes: number;
}

export function registerAdminTestLinkRoutes(app: FastifyInstance, options: Options): void {
  const { db, provider, appBaseUrl, idleMinutes } = options;
  const editor = { preHandler: requireAdmin(db, 'editor', idleMinutes) };

  /** Entry links with TEST- IDs, signed like real provider links. */
  app.post('/api/admin/surveys/:id/test-links', editor, async (request, reply) => {
    const survey = params.safeParse(request.params);
    const input = body.safeParse(request.body ?? {});
    if (!survey.success || !input.success)
      return reply.code(400).send({ error: 'invalid_request' });
    if ((await db.survey.count({ where: { id: survey.data.id } })) === 0) {
      return reply.code(404).send({ error: 'survey_not_found' });
    }
    const entry = surveyEntryUrl(appBaseUrl, survey.data.id);
    const links = Array.from({ length: input.data.count }, () =>
      provider.testEntryUrl(entry, newTestRespondentId()),
    );
    await audit(db, adminOf(request).id, 'test_links_created', survey.data.id, {
      count: links.length,
    });
    return { links };
  });

  /** Deletes all test respondents of a survey with their answers and redirect logs. */
  app.delete('/api/admin/surveys/:id/test-data', editor, async (request, reply) => {
    const survey = params.safeParse(request.params);
    if (!survey.success) return reply.code(400).send({ error: 'invalid_request' });
    const where = { surveyId: survey.data.id, isTest: true };
    const deleted = await db.$transaction(async (tx) => {
      await tx.answer.deleteMany({ where: { respondent: where } });
      return tx.respondent.deleteMany({ where });
    });
    await audit(db, adminOf(request).id, 'test_data_deleted', survey.data.id, {
      respondents: deleted.count,
    });
    return { deleted: deleted.count };
  });
}
