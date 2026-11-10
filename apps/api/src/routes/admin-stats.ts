import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../admin/auth.js';
import { completesPerDay, counters } from '../stats/fieldwork.js';

const params = z.object({ id: z.uuid() });
const RECENT = 20;

/** Live fieldwork figures for the dashboard (DSA-605). Test respondents are left out. */
export function registerAdminStatsRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; idleMinutes: number },
): void {
  const { db, idleMinutes } = options;

  app.get(
    '/api/admin/surveys/:id/stats',
    { preHandler: requireAdmin(db, 'viewer', idleMinutes) },
    async (request, reply) => {
      const survey = params.safeParse(request.params);
      if (!survey.success) return reply.code(400).send({ error: 'invalid_request' });
      const surveyId = survey.data.id;
      if ((await db.survey.count({ where: { id: surveyId } })) === 0) {
        return reply.code(404).send({ error: 'survey_not_found' });
      }
      const real = { surveyId, isTest: false };

      const [groups, completes, quotas, recent] = await Promise.all([
        db.respondent.groupBy({ by: ['status'], where: real, _count: { _all: true } }),
        db.respondent.findMany({
          where: { ...real, status: 'complete', endedAt: { not: null } },
          select: { startedAt: true, endedAt: true },
        }),
        db.quotaCell.findMany({
          where: { surveyId },
          orderBy: { name: 'asc' },
          select: { name: true, kind: true, target: true, currentCount: true },
        }),
        db.respondent.findMany({
          where: real,
          orderBy: { startedAt: 'desc' },
          take: RECENT,
          select: {
            panelRespondentId: true,
            status: true,
            startedAt: true,
            endedAt: true,
            deviceType: true,
            qualityFlags: true,
          },
        }),
      ]);

      const ended = completes.flatMap((r) => (r.endedAt ? [r.endedAt] : []));
      return {
        counters: counters(
          Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
          completes.flatMap((r) =>
            r.endedAt ? [(r.endedAt.getTime() - r.startedAt.getTime()) / 1000] : [],
          ),
        ),
        completesPerDay: completesPerDay(ended),
        quotas,
        recent: recent.map((r) => ({
          ...r,
          qualityFlags: Array.isArray(r.qualityFlags) ? r.qualityFlags.map(String) : [],
        })),
        updatedAt: new Date().toISOString(),
      };
    },
  );
}
