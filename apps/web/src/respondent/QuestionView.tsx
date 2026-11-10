import { answerSchema, type AnswerValue } from '@survey-dynata/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { ErrorMessage } from '@/components/survey/ErrorMessage';
import { PrimaryButton } from '@/components/survey/PrimaryButton';
import { SurveyLayout } from '@/components/survey/SurveyLayout';
import type { PresentedQuestion } from './api';
import type { Messages } from './messages';
import { QuestionRenderer } from './questions/QuestionRenderer';
import type { AnswerMeta } from './questions/types';

/** A friendly validation message for an incomplete or invalid answer of this type. */
function invalidMessage(type: string, t: Messages): string {
  const map: Record<string, string> = {
    single_choice: t.invalid.single_choice,
    timed_exposure: t.invalid.single_choice,
    multi_choice: t.invalid.multi_choice,
    grid_single: t.invalid.grid,
    grid_multi: t.invalid.grid,
    open_text: t.invalid.open_text,
    number: t.invalid.number,
    rating: t.invalid.rating,
    slider: t.invalid.scale,
    semantic_differential: t.invalid.scale,
    mapping: t.invalid.scale,
    maxdiff: t.invalid.maxdiff,
    constant_sum: t.invalid.constant_sum,
    click_map: t.invalid.click_map,
    paired_comparison: t.invalid.paired_comparison,
  };
  return map[type] ?? t.invalid.other;
}

interface QuestionViewProps {
  question: PresentedQuestion;
  progress: number;
  busy: boolean;
  /** Error from the server (e.g. connection lost), shown below the question. */
  error: string | null;
  t: Messages;
  /** `honeypot` is the hidden field's content: empty for people. */
  onSubmit: (value: AnswerValue, meta: AnswerMeta, honeypot: string) => void;
}

/**
 * One question per screen (DSA-404): the answer is checked with the shared schema before it
 * is sent, so respondents get an immediate, friendly message; the server checks it again.
 */
export function QuestionView({ question, progress, busy, error, t, onSubmit }: QuestionViewProps) {
  const headingId = useId();
  const errorId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [value, setValue] = useState<AnswerValue>();
  const [meta, setMeta] = useState<AnswerMeta>({});
  const [showError, setShowError] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  // A new question starts empty and gets the focus, so screen readers announce it.
  useEffect(() => {
    heading.current?.focus();
  }, [question.code]);

  const valid =
    value !== undefined &&
    answerSchema(question.type as never, question.config).safeParse(value).success;
  const message = showError && !valid ? invalidMessage(question.type, t) : error;

  return (
    <SurveyLayout
      progress={progress}
      progressLabel={t.progress}
      footer={
        <PrimaryButton
          busy={busy}
          onClick={() => {
            if (!valid) {
              setShowError(true);
              return;
            }
            onSubmit(value, meta, honeypot);
          }}
        >
          {t.next}
        </PrimaryButton>
      }
    >
      <h1
        id={headingId}
        ref={heading}
        tabIndex={-1}
        className="text-lg leading-snug font-semibold outline-none sm:text-xl"
      >
        {question.text}
      </h1>
      <div className="mt-6">
        <QuestionRenderer
          question={question}
          value={value}
          onChange={(next, nextMeta) => {
            setValue(next);
            if (nextMeta) setMeta(nextMeta);
          }}
          labelledBy={headingId}
          describedBy={message ? errorId : undefined}
          t={t}
        />
      </div>
      {message ? <ErrorMessage id={errorId}>{message}</ErrorMessage> : null}
      {/* Honeypot (DSA-502): off-screen and skipped by keyboard and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => {
              setHoneypot(event.target.value);
            }}
          />
        </label>
      </div>
    </SurveyLayout>
  );
}
