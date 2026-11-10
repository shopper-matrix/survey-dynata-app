import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { messagePage } from '../http/pages.js';

// Test links (DSA-606): respondents whose ID starts with TEST- are test data. They run through
// the real flow but finish on an internal page instead of the provider, are not counted in
// quotas or dashboards, and can be deleted in one go.

export const TEST_ID_PREFIX = 'TEST-';

export const isTestRespondentId = (panelRespondentId: string) =>
  panelRespondentId.startsWith(TEST_ID_PREFIX);

export function newTestRespondentId(): string {
  return `${TEST_ID_PREFIX}${randomBytes(5).toString('hex').toUpperCase()}`;
}

const TEST_END_PATH = '/api/test-end';

/** Where a test respondent goes instead of the provider's end link. */
export function testEndPageUrl(outcome: string, providerUrl: string): string {
  const query = new URLSearchParams({ outcome, target: providerUrl });
  return `${TEST_END_PATH}?${query.toString()}`;
}

const pageQuery = z.object({ outcome: z.string().max(40), target: z.string().max(2000) });

/** Shows the outcome and the link that would have gone to the provider (display only). */
export function registerTestEndPage(app: FastifyInstance): void {
  app.get(TEST_END_PATH, (request, reply) => {
    const query = pageQuery.safeParse(request.query);
    const outcome = query.success ? query.data.outcome : 'unknown';
    const target = query.success ? query.data.target : '';
    return reply
      .type('text/html; charset=utf-8')
      .send(
        messagePage(
          `Test finished: ${outcome}`,
          `This was a test respondent, so nothing was sent to the panel. Live respondents would now be redirected to: ${target}`,
        ),
      );
  });
}
