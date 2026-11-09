import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ratingQuestion } from '../../fake-data';
import { QuestionScreen } from '../QuestionScreen';

const points = Array.from({ length: ratingQuestion.max - ratingQuestion.min + 1 }, (_, index) =>
  String(ratingQuestion.min + index),
);

/** 0–10 scale as large numbered buttons (two rows on phones). */
export function RatingQuestion() {
  const [value, setValue] = useState('');

  return (
    <QuestionScreen
      step="rating"
      question={ratingQuestion.text}
      validationError={value ? null : 'Please choose a number.'}
    >
      {({ questionId, errorId, showError }) => (
        <>
          <RadioGroup
            value={value}
            onValueChange={setValue}
            aria-labelledby={questionId}
            aria-describedby={showError ? errorId : undefined}
            aria-invalid={showError}
            className="grid-cols-6 gap-2 sm:grid-cols-11"
          >
            {points.map((point) => (
              <label
                key={point}
                htmlFor={`rating-${point}`}
                className="relative flex h-12 cursor-pointer items-center justify-center rounded-lg border bg-card text-base font-medium hover:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground"
              >
                <RadioGroupItem id={`rating-${point}`} value={point} className="sr-only" />
                {point}
              </label>
            ))}
          </RadioGroup>
          <div className="mt-2 flex justify-between gap-4 text-sm text-muted-foreground">
            <span>
              {ratingQuestion.min} = {ratingQuestion.lowLabel}
            </span>
            <span className="text-right">
              {ratingQuestion.max} = {ratingQuestion.highLabel}
            </span>
          </div>
        </>
      )}
    </QuestionScreen>
  );
}
