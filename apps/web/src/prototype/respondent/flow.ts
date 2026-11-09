/** Order of the prototype's respondent screens; drives the progress bar and the Next button. */
export const respondentFlow = [
  'welcome',
  'single',
  'multi',
  'grid',
  'open',
  'number',
  'rating',
  'end/complete',
] as const;

export type FlowStep = (typeof respondentFlow)[number];

export function nextStep(step: FlowStep): FlowStep {
  const index = respondentFlow.indexOf(step);
  return respondentFlow[Math.min(index + 1, respondentFlow.length - 1)] ?? step;
}

/** Progress in percent: 0 on the welcome screen, 100 on the end screen. */
export function progressPercent(step: FlowStep): number {
  return Math.round((respondentFlow.indexOf(step) / (respondentFlow.length - 1)) * 100);
}
