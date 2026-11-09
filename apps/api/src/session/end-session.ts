import type { Prisma, PrismaClient } from '@survey-dynata/shared/db/client';
import type { EndOutcome, SampleProvider } from '../providers/sample-provider.js';

/** Many respondents may finish at once and queue on the quota row locks. */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 15_000 };

export interface SessionEnd {
  outcome: EndOutcome;
  redirectUrl: string;
}

/** Runs inside the end transaction before the outcome is stored; may change the outcome. */
export type OutcomeHook = (
  tx: Prisma.TransactionClient,
  respondent: { id: string; surveyId: string },
  outcome: EndOutcome,
) => Promise<EndOutcome>;

/**
 * Ends a respondent's session exactly once: sets the final status, writes the RedirectLog and
 * returns the provider's end link. Calling it again (refresh, double click) returns the first
 * result unchanged. The respondent row is locked so concurrent calls cannot both write.
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
    const existing = await tx.redirectLog.findFirst({
      where: { respondentId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return { outcome: existing.outcome, redirectUrl: existing.url };

    const respondent = await tx.respondent.findUniqueOrThrow({
      where: { id: respondentId },
      select: { id: true, surveyId: true, panelRespondentId: true },
    });
    const final = beforeStore ? await beforeStore(tx, respondent, outcome) : outcome;
    const redirectUrl = provider.endLink(respondent, final);

    await tx.respondent.update({
      where: { id: respondentId },
      data: { status: final, endedAt: new Date() },
    });
    await tx.redirectLog.create({ data: { respondentId, outcome: final, url: redirectUrl } });
    return { outcome: final, redirectUrl };
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
  });
  return log ? { outcome: log.outcome, redirectUrl: log.url } : null;
}
