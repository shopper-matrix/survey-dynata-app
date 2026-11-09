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
};

export type Messages = typeof en;
