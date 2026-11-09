import type { AnswerValue } from '@survey-dynata/shared';
import type { PresentedQuestion } from '../api';
import type { Messages } from '../messages';

/** Extra facts about an answer, e.g. the response time of a timed exposure. */
export interface AnswerMeta {
  responseTimeMs?: number;
}

/** Every question component: shows one presented question and reports the answer value. */
export interface QuestionProps {
  question: PresentedQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue, meta?: AnswerMeta) => void;
  /** Id of the question heading, for aria-labelledby. */
  labelledBy: string;
  /** Id of the error message while one is shown, for aria-describedby. */
  describedBy: string | undefined;
  t: Messages;
}

export interface Item {
  id: string;
  label: string;
  exclusive?: boolean;
  imageUrl?: string;
}

/** Typed access to a presented config field (validated by the API, see shared config schemas). */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed accessor
export const field = <T>(question: PresentedQuestion, key: string): T => question.config[key] as T;

/** A copy of the record without `key`. */
export const without = <V>(record: Record<string, V>, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
