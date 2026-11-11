import type { FastifyInstance } from 'fastify';
import { messagePage } from '../http/pages.js';
import { hasValidSignature } from './signature.js';

// Mock mode only: stands in for Dynata's dkr1.ssisurveys.com end page, so local tests show
// which outcome would have been reported and whether the link was signed correctly.

function outcomeOf(params: URLSearchParams): string {
  if (params.get('svFlag') === '1') return 'Invalid entry signature';
  if (params.has('qflag') || params.has('qFlag')) return 'Quality termination';
  switch (params.get('rst')) {
    case '1':
      return 'Complete';
    case '2':
      return 'Screen-out';
    case '3':
      return 'Over-quota';
    default:
      return 'Unknown result code';
  }
}

export const MOCK_END_PATH = '/mock-dynata/end';

export function registerMockEndPage(
  app: FastifyInstance,
  options: { appBaseUrl: string; secret: string },
): void {
  const base = options.appBaseUrl.replace(/\/+$/, '');
  app.get(MOCK_END_PATH, (request, reply) => {
    const url = `${base}${request.url}`;
    const params = new URL(url).searchParams;
    const signature = hasValidSignature(url, options.secret) ? 'valid' : 'INVALID';
    return reply
      .type('text/html; charset=utf-8')
      .send(
        messagePage(
          `Mock Dynata: ${outcomeOf(params)}`,
          `Respondent ${params.get('psid') ?? '?'} returned with ${params.toString()}. Signature: ${signature}. In live mode this would be Dynata's end page.`,
        ),
      );
  });
}
