import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import type { EndOutcome, SampleProvider } from '../providers/sample-provider.js';
import { testEndPageUrl } from '../test-links/test-links.js';

/** Many respondents may finish at once and queue on the quota row locks. */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 15_000 };

export interface SessionEnd {
  outcome: EndOutcome;
  redirectUrl: string;
}

/** Runs inside the end transaction before the outcome is stored; may change the outcome. */
export type OutcomeHook = (
  tx: Prisma.TransactionClient,
  respondent: { id: string; surveyId: string; isTest: boolean },
  outcome: EndOutcome,
) => Promise<EndOutcome>;

/** The RedirectLog keeps the provider link; test respondents are shown an internal page. */
function sessionEnd(outcome: EndOutcome, providerUrl: string, isTest: boolean): SessionEnd {
  return { outcome, redirectUrl: isTest ? testEndPageUrl(outcome, providerUrl) : providerUrl };
}

/**
 * Ends a respondent's session exactly once: sets the final status, writes the RedirectLog and
 * returns where to send the respondent. Calling it again (refresh, double click) returns the
 * first result unchanged. The respondent row is locked so concurrent calls cannot both write.
 */
export async function endSession(
  db: PrismaClient,
  provider: SampleProvider,
  respondentId: string,
  outcome: EndOutcome,
  beforeStore?: OutcomeHook,
): Promise<SessionEnd> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Respondent" WHERE id = ${respondentId}::uuid FOR UPDATE`;
    const respondent = await tx.respondent.findUniqueOrThrow({
      where: { id: respondentId },
      select: { id: true, surveyId: true, panelRespondentId: true, isTest: true },
    });
    const existing = await tx.redirectLog.findFirst({
      where: { respondentId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return sessionEnd(existing.outcome, existing.url, respondent.isTest);

    const final = beforeStore ? await beforeStore(tx, respondent, outcome) : outcome;
    const providerUrl = provider.endLink(respondent, final);

    await tx.respondent.update({
      where: { id: respondentId },
      data: { status: final, endedAt: new Date() },
    });
    await tx.redirectLog.create({ data: { respondentId, outcome: final, url: providerUrl } });
    return sessionEnd(final, providerUrl, respondent.isTest);
  }, TRANSACTION_OPTIONS);
}

/** The stored end of a finished session, if any. */
export async function storedSessionEnd(
  db: PrismaClient,
  respondentId: string,
): Promise<SessionEnd | null> {
  const log = await db.redirectLog.findFirst({
    where: { respondentId },
    orderBy: { createdAt: 'asc' },
    include: { respondent: { select: { isTest: true } } },
  });
  return log ? sessionEnd(log.outcome, log.url, log.respondent.isTest) : null;
}
