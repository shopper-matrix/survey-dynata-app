/**
 * The survey link given to a sample provider. The provider appends its own parameters (for
 * Dynata `psid`, plus `_k` and `_s` on signed links, see docs/dynata-integration.md).
 */
export function surveyEntryUrl(appBaseUrl: string, surveyId: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}/s/${surveyId}`;
}
