// Respondent interface texts (DSA-406). Every string shown to respondents comes from here;
// adding a language means adding one dictionary. Question texts come translated from the API.

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
  end: {
    complete: { title: 'Thank you!', message: 'Your answers have been saved.' },
    screenout: {
      title: 'Thank you for your time',
      message: 'This survey is looking for a different profile, so it ends here.',
    },
    overquota: {
      title: 'Thank you for your interest',
      message: 'We already have enough answers from people like you.',
    },
    quality: { title: 'Thank you for your time', message: 'This survey ends here.' },
  },
  redirecting: 'Taking you back to your panel…',
  notRedirected: 'Not taken back automatically?',
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

export const de: Messages = {
  loading: 'Wird geladen …',
  start: 'Starten',
  decline: 'Nein, danke',
  about: (minutes) => `Etwa ${String(minutes)} Minuten`,
  privacyHeading: 'Ihre Privatsphäre',
  privacyFallback:
    'Wir fragen nicht nach Ihrem Namen, Ihrer E-Mail-Adresse oder Telefonnummer. Ihre Antworten werden nur für Forschungszwecke verwendet.',
  privacyPolicy: 'Vollständige Datenschutzerklärung lesen',
  botCheckFailed:
    'Wir konnten nicht bestätigen, dass Sie ein Mensch sind. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
  noSession:
    'Dieser Umfragelink ist nicht mehr gültig. Bitte öffnen Sie die Umfrage erneut über Ihre Einladung.',
  error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
  retry: 'Erneut versuchen',
  cannotJudge: 'Kann ich nicht beurteilen',
  best: 'Am wichtigsten',
  worst: 'Am wenigsten wichtig',
  setOf: (n, total) => `Set ${String(n)} von ${String(total)}`,
  pointsLeft: (n) => `Noch ${String(n)} Punkte zu verteilen`,
  pointsOver: (n) => `${String(n)} Punkte zu viel`,
  group: (n) => `Gruppe ${String(n)}`,
  groupFor: (item) => `Gruppe für ${item}`,
  horizontal: 'Links ↔ rechts',
  vertical: 'Unten ↔ oben',
  whereFor: (target) => `Wo für: ${target}?`,
  pair: (n, total) => `Vergleich ${String(n)} von ${String(total)}`,
  lookClosely: 'Schauen Sie genau hin. Das Bild verschwindet nach wenigen Sekunden.',
  showAgainNotPossible: 'Das Bild wurde einmal gezeigt. Bitte antworten Sie aus der Erinnerung.',
  continue: 'Weiter',
  next: 'Weiter',
  end: {
    complete: { title: 'Vielen Dank!', message: 'Ihre Antworten wurden gespeichert.' },
    screenout: {
      title: 'Vielen Dank für Ihre Zeit',
      message: 'Diese Umfrage sucht ein anderes Profil, deshalb endet sie hier.',
    },
    overquota: {
      title: 'Vielen Dank für Ihr Interesse',
      message: 'Wir haben bereits genügend Antworten von Personen wie Ihnen.',
    },
    quality: { title: 'Vielen Dank für Ihre Zeit', message: 'Diese Umfrage endet hier.' },
  },
  redirecting: 'Sie werden zu Ihrem Panel zurückgeleitet …',
  notRedirected: 'Nicht automatisch weitergeleitet?',
  progress: 'Fortschritt der Umfrage',
  invalid: {
    single_choice: 'Bitte wählen Sie eine Antwort aus.',
    multi_choice: 'Bitte wählen Sie mindestens eine Antwort aus.',
    grid: 'Bitte beantworten Sie jede Zeile.',
    open_text: 'Bitte schreiben Sie eine kurze Antwort.',
    number: 'Bitte geben Sie eine Zahl im erlaubten Bereich ein.',
    rating: 'Bitte wählen Sie eine Zahl aus.',
    scale: 'Bitte beantworten Sie jeden Punkt.',
    maxdiff: 'Bitte wählen Sie in jedem Set das wichtigste und das unwichtigste Kriterium.',
    constant_sum: 'Bitte verteilen Sie genau alle Punkte.',
    click_map: 'Bitte wählen Sie für jeden Punkt einen Ort aus.',
    paired_comparison: 'Bitte beantworten Sie jeden Vergleich.',
    other: 'Bitte beantworten Sie die Frage.',
  },
};

const dictionaries: Record<string, Messages> = { en, de };

/** Interface texts in the session's language; English when that language has no dictionary. */
export function messagesFor(language: string | undefined): Messages {
  return (language ? dictionaries[language] : undefined) ?? en;
}
