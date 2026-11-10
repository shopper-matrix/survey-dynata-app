import { chooseLanguage } from '@survey-dynata/shared';
import type { Respondent } from '@survey-dynata/shared/db';
import { Prisma, type PrismaClient } from '@survey-dynata/shared/db/client';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { deviceTypeFromUserAgent } from '../http/device.js';
import { isTestRespondentId } from '../test-links/test-links.js';
import { pages } from '../http/pages.js';
import { ENTRY_RATE_LIMIT } from '../http/security.js';
import { duplicateFlags, fingerprint } from '../quality/fingerprint.js';
import { startRespondentSession } from '../http/session.js';
import {
  ProviderUnavailableError,
  type EntryVerification,
  type SampleProvider,
} from '../providers/sample-provider.js';

/** Where respondents continue after entering; the respondent UI decides the current screen. */
export const SURVEY_PAGE_PATH = '/survey';

interface EntryRouteOptions {
  db: PrismaClient;
  provider: SampleProvider;
  appBaseUrl: string;
  /** Keys the salted IP and device hashes. */
  fingerprintSecret: string;
}

const paramsSchema = z.object({ surveyId: z.uuid() });

/**
 * GET /s/:surveyId — where the sample provider sends each respondent. A Respondent is only
 * created after the provider verified the signed entry link.
 */
export function registerEntryRoute(app: FastifyInstance, options: EntryRouteOptions): void {
  const { db, provider } = options;
  const baseUrl = options.appBaseUrl.replace(/\/+$/, '');
  const secure = baseUrl.startsWith('https://');

  const sendPage = (reply: FastifyReply, status: number, html: string) =>
    reply.code(status).type('text/html; charset=utf-8').send(html);

  const resume = (
    reply: FastifyReply,
    respondent: Respondent,
    endLinks: EntryVerification['endLinks'],
  ) => {
    if (respondent.status !== 'started') {
      // Already finished (or abandoned): never count them twice.
      return reply.redirect(endLinks.quality);
    }
    startRespondentSession(reply, respondent.id, { secure });
    return reply.redirect(SURVEY_PAGE_PATH);
  };

  app.get('/s/:surveyId', { config: { rateLimit: ENTRY_RATE_LIMIT } }, async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const survey = params.success
      ? await db.survey.findUnique({
          where: { id: params.data.surveyId },
          select: { id: true, status: true, pausedAt: true, language: true, translations: true },
        })
      : null;
    if (!survey) return sendPage(reply, 404, pages.surveyNotFound);

    // The URL exactly as the respondent's browser requested it: the signature covers it.
    const entryUrl = `${baseUrl}${request.url}`;
    const panelRespondentId = provider.respondentId(new URL(entryUrl));
    if (!panelRespondentId) return sendPage(reply, 400, pages.missingRespondentId);

    let verification: EntryVerification;
    try {
      verification = await provider.verifyEntry(entryUrl);
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      request.log.error({ err: error, surveyId: survey.id }, 'Sample provider unavailable');
      return sendPage(reply, 503, pages.providerUnavailable);
    }

    if (!verification.verified) {
      request.log.warn(
        { surveyId: survey.id, panelRespondentId },
        'Entry link failed verification',
      );
      return reply.redirect(verification.invalidLink);
    }

    if (survey.status !== 'live' && survey.status !== 'test') {
      return reply.redirect(verification.endLinks.overquota);
    }

    const key = { surveyId_panelRespondentId: { surveyId: survey.id, panelRespondentId } };
    const existing = await db.respondent.findUnique({ where: key });
    if (existing) return resume(reply, existing, verification.endLinks);

    // Paused: respondents already in progress may finish (above), new ones are turned away.
    if (survey.pausedAt) return reply.redirect(verification.endLinks.overquota);

    const isTest = survey.status === 'test' || isTestRespondentId(panelRespondentId);
    const { ipHash, deviceHash } = fingerprint(
      options.fingerprintSecret,
      request.ip,
      request.headers,
    );
    // Testers share one machine and network, so only real entrants are compared.
    const earlier = { surveyId: survey.id, isTest: false, ipHash };
    const qualityFlags = isTest
      ? []
      : duplicateFlags({
          sameIp: await db.respondent.count({ where: earlier }),
          sameIpAndDevice: await db.respondent.count({ where: { ...earlier, deviceHash } }),
        });

    try {
      const respondent = await db.respondent.create({
        data: {
          surveyId: survey.id,
          panelRespondentId,
          isTest,
          ipHash,
          deviceHash,
          qualityFlags,
          deviceType: deviceTypeFromUserAgent(request.headers['user-agent']),
          language: chooseLanguage(
            [survey.language, ...Object.keys(survey.translations as Record<string, unknown>)],
            survey.language,
            new URL(entryUrl).searchParams.get('lang'),
            request.headers['accept-language'],
          ),
        },
      });
      startRespondentSession(reply, respondent.id, { secure });
      return await reply.redirect(SURVEY_PAGE_PATH);
    } catch (error) {
      // Two simultaneous requests (e.g. a double click): the unique index lets one win.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await db.respondent.findUniqueOrThrow({ where: key });
        return resume(reply, winner, verification.endLinks);
      }
      throw error;
    }
  });
}
