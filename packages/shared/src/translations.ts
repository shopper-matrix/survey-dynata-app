import { z } from 'zod';

// Translations (DSA-406). A survey is written in its main language; translations add other
// languages. Question labels are translated by id, so option order and codes never change.

const language = z.string().min(2).max(10);

export const surveyTranslationsSchema = z.record(
  language,
  z.object({
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    privacyNotice: z.string().min(1).optional(),
  }),
);

/**
 * `labels` keys: the id of an option, row, column, item, stimulus, zone, target or comparison
 * question; `<pairId>.left` / `<pairId>.right` for semantic differentials; and the field names
 * lowLabel, highLabel, body, unit, imageAlt, xAxis.left, xAxis.right, yAxis.bottom, yAxis.top.
 */
export const questionTranslationsSchema = z.record(
  language,
  z.object({
    text: z.string().min(1).optional(),
    labels: z.record(z.string(), z.string().min(1)).default({}),
  }),
);

export type SurveyTranslations = z.infer<typeof surveyTranslationsSchema>;
export type QuestionTranslations = z.infer<typeof questionTranslationsSchema>;

const LIST_FIELDS = [
  'options',
  'rows',
  'columns',
  'items',
  'stimuli',
  'zones',
  'targets',
  'questions',
];
const TEXT_FIELDS = ['lowLabel', 'highLabel', 'body', 'unit', 'imageAlt'];

type Translatable = Record<string, unknown>;

/** Question text and config in `lang`, falling back to the original for missing labels. */
export function translateQuestion<C extends Translatable>(
  text: string,
  config: C,
  translations: QuestionTranslations,
  lang: string | null,
): { text: string; config: C } {
  const translation = lang ? translations[lang] : undefined;
  if (!translation) return { text, config };
  const labels = translation.labels;
  const out: Translatable = { ...config };

  for (const key of LIST_FIELDS) {
    const list = out[key];
    if (!Array.isArray(list)) continue;
    out[key] = list.map((item: unknown) => {
      if (typeof item !== 'object' || item === null || !('id' in item)) return item;
      const entry = item as { id: string; label?: string; left?: string; right?: string };
      return {
        ...entry,
        ...(labels[entry.id] && entry.label !== undefined ? { label: labels[entry.id] } : {}),
      };
    });
  }
  if (Array.isArray(out.pairs)) {
    out.pairs = (out.pairs as unknown[]).map((pair) => {
      if (typeof pair !== 'object' || pair === null || !('left' in pair)) return pair;
      const entry = pair as { id: string; left: string; right: string };
      return {
        ...entry,
        left: labels[`${entry.id}.left`] ?? entry.left,
        right: labels[`${entry.id}.right`] ?? entry.right,
      };
    });
  }
  for (const key of TEXT_FIELDS) {
    if (typeof out[key] === 'string' && labels[key]) out[key] = labels[key];
  }
  for (const [axis, ends] of [
    ['xAxis', ['left', 'right']],
    ['yAxis', ['bottom', 'top']],
  ] as const) {
    const value = out[axis];
    if (typeof value !== 'object' || value === null) continue;
    const translated: Record<string, unknown> = { ...value };
    for (const end of ends) {
      const label = labels[`${axis}.${end}`];
      if (label) translated[end] = label;
    }
    out[axis] = translated;
  }
  return { text: translation.text ?? text, config: out as C };
}

/**
 * The respondent's language: the link parameter if offered, else the first browser language
 * offered (Accept-Language order), else the survey's main language.
 */
export function chooseLanguage(
  offered: string[],
  mainLanguage: string,
  requested: string | null,
  acceptLanguage: string | undefined,
): string {
  const base = (tag: string) => tag.trim().toLowerCase().split(/[-_;]/)[0] ?? '';
  const available = new Set(offered.map(base));
  if (requested && available.has(base(requested))) return base(requested);
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = base(part);
    if (tag && available.has(tag)) return tag;
  }
  return mainLanguage;
}
