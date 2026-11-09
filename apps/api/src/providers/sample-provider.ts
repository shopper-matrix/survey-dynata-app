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
}

/** The provider could not be reached or answered unexpectedly. */
export class ProviderUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderUnavailableError';
  }
}
