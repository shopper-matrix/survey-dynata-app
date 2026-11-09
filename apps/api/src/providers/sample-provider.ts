import type { FastifyInstance } from 'fastify';

// Provider-neutral view of a sample provider (Dynata today; Cint, Lucid… later). Routes only
// use this interface, so provider-specific names stay inside the provider's own module.

export type EndOutcome = 'complete' | 'screenout' | 'overquota' | 'quality';

export interface EntryVerification {
  verified: boolean;
  /** Where to send the respondent for each outcome. */
  endLinks: Record<EndOutcome, string>;
  /** Where to send a respondent whose entry link failed verification. */
  invalidLink: string;
}

export interface SampleProvider {
  /** The provider's respondent ID from the entry URL, or null when missing. */
  respondentId(entryUrl: URL): string | null;
  /** Verifies the signed entry link and returns this respondent's end links. */
  verifyEntry(entryUrl: string): Promise<EntryVerification>;
  /** The (signed) link that returns a respondent to the provider with this outcome. */
  endLink(respondent: { panelRespondentId: string }, outcome: EndOutcome): string;
  /** An entry link for a test respondent, signed like the provider would sign it. */
  testEntryUrl(surveyEntryUrl: string, panelRespondentId: string): string;
  /** Provider-specific routes, e.g. a local end page in mock mode. */
  registerRoutes?(app: FastifyInstance): void;
}

/** The provider could not be reached or answered unexpectedly. */
export class ProviderUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderUnavailableError';
  }
}
