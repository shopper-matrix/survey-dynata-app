// Respondent interface texts. Every string shown to respondents comes from here, so adding a
// language (DSA-406) means adding one dictionary.

export const en = {
  loading: 'Loading…',
  start: 'Start',
  decline: 'No thanks',
  about: (minutes: number) => `About ${String(minutes)} minutes`,
  privacyHeading: 'Your privacy',
  privacyFallback:
    'We do not ask for your name, email or phone number. Your answers are used only for research.',
  privacyPolicy: 'Read the full privacy policy',
  botCheckFailed:
    'We could not confirm that you are a person. Please reload the page and try again.',
  noSession:
    'This survey link is no longer valid. Please open the survey again from your invitation.',
  error: 'Something went wrong. Please try again.',
  retry: 'Try again',
  cannotJudge: 'I can’t say',
  best: 'Most important',
  worst: 'Least important',
  setOf: (n: number, total: number) => `Set ${String(n)} of ${String(total)}`,
  pointsLeft: (n: number) => `${String(n)} points left to distribute`,
  pointsOver: (n: number) => `${String(n)} points too many`,
  group: (n: number) => `Group ${String(n)}`,
  groupFor: (item: string) => `Group for ${item}`,
  horizontal: 'Left ↔ right',
  vertical: 'Bottom ↔ top',
  whereFor: (target: string) => `Where for: ${target}?`,
  pair: (n: number, total: number) => `Comparison ${String(n)} of ${String(total)}`,
  lookClosely: 'Look closely. The picture disappears after a few seconds.',
  showAgainNotPossible: 'The picture was shown once. Please answer from memory.',
  continue: 'Continue',
  next: 'Next',
  progress: 'Survey progress',
  invalid: {
    single_choice: 'Please choose one answer.',
    multi_choice: 'Please choose at least one answer.',
    grid: 'Please answer every line.',
    open_text: 'Please write a short answer.',
    number: 'Please enter a number in the allowed range.',
    rating: 'Please choose a number.',
    scale: 'Please answer every item.',
    maxdiff: 'Please choose the most and the least important item in every set.',
    constant_sum: 'Please distribute exactly all points.',
    click_map: 'Please choose a place for every item.',
    paired_comparison: 'Please answer every comparison.',
    other: 'Please answer the question.',
  },
};

export type Messages = typeof en;
