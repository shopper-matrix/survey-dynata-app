/**
 * The link we give Dynata for a survey. Dynata appends `project`, `psid`, `_k` and `_s` when
 * it sends a respondent (to be confirmed with Dynata, see docs/dynata-integration.md).
 */
export function dynataEntryUrl(appBaseUrl: string, surveyId: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}/s/${surveyId}`;
}
