import type { AnswerValue } from '@survey-dynata/shared';
import { useState } from 'react';
import type { PresentedQuestion } from '@/respondent/api';
import { messagesFor } from '@/respondent/messages';
import { QuestionRenderer } from '@/respondent/questions/QuestionRenderer';

/**
 * Live preview of a question in a phone-sized frame (375 px), rendered with the same components
 * respondents get. Remount with a `key` when the question changes to reset the answer.
 */
export function PhonePreview({
  question,
  language,
}: {
  question: PresentedQuestion;
  language: string;
}) {
  const [value, setValue] = useState<AnswerValue>();
  return (
    <figure className="mx-auto w-full max-w-[375px]">
      <div className="rounded-[2rem] border-8 border-neutral-800 bg-background shadow-lg dark:border-neutral-600">
        <div className="h-[560px] overflow-y-auto px-4 py-6">
          <h2 id="preview-heading" className="text-lg leading-snug font-semibold">
            {question.text}
          </h2>
          <div className="mt-6">
            <QuestionRenderer
              question={question}
              value={value}
              onChange={setValue}
              labelledBy="preview-heading"
              describedBy={undefined}
              t={messagesFor(language)}
            />
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-sm text-muted-foreground">
        Phone preview
      </figcaption>
    </figure>
  );
}
