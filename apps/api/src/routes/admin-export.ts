import { RespondentStatus } from '@survey-dynata/shared/db';
import type { PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit } from '../admin/audit.js';
import { adminOf, requireAdmin } from '../admin/auth.js';
import { buildColumns } from '../export/columns.js';
import { writeCsv } from '../export/csv.js';
import { loadExportData } from '../export/load.js';
import { writeSav } from '../export/sav.js';

const params = z.object({ id: z.uuid() });
const query = z.object({
  format: z.enum(['csv', 'sav']).default('csv'),
  /** Comma-separated statuses, e.g. "complete,screenout". */
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',') : []))
    .pipe(z.array(z.enum(RespondentStatus))),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includeTest: z.enum(['true', 'false']).default('false'),
  /** CSV only: value labels instead of codes. */
  labels: z.enum(['true', 'false']).default('false'),
});

const GERMAN: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};

/** File name from the title: ASCII letters, digits and dashes only (umlauts transliterated). */
function fileName(title: string, extension: string): string {
  const ascii = title
    .replace(/[äöüÄÖÜß]/g, (char) => GERMAN[char] ?? char)
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${ascii || 'survey'}.${extension}`;
}

export function registerAdminExportRoutes(
  app: FastifyInstance,
  options: { db: PrismaClient; idleMinutes: number },
): void {
  const { db, idleMinutes } = options;

  app.get(
    '/api/admin/surveys/:id/export',
    { preHandler: requireAdmin(db, 'editor', idleMinutes) },
    async (request, reply) => {
      const survey = params.safeParse(request.params);
      const input = query.safeParse(request.query);
      if (!survey.success || !input.success)
        return reply.code(400).send({ error: 'invalid_request' });
      if ((await db.survey.count({ where: { id: survey.data.id } })) === 0) {
        return reply.code(404).send({ error: 'survey_not_found' });
      }

      const { format, status, from, to } = input.data;
      const data = await loadExportData(db, survey.data.id, {
        statuses: status,
        includeTest: input.data.includeTest === 'true',
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      const columns = buildColumns(data.questions, data.assignmentNames);
      await audit(db, adminOf(request).id, 'data_exported', survey.data.id, {
        format,
        rows: data.rows.length,
        filters: request.query,
      });

      const name = fileName(data.title, format);
      void reply.header('Content-Disposition', `attachment; filename="${name}"`);
      if (format === 'sav') {
        return reply.type('application/x-spss-sav').send(writeSav(columns, data.rows, data.title));
      }
      return reply
        .type('text/csv; charset=utf-8')
        .send(writeCsv(columns, data.rows, input.data.labels === 'true'));
    },
  );
}
