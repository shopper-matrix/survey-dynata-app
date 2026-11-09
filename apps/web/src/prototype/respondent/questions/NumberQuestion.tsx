import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { numberQuestion } from '../../fake-data';
import { QuestionScreen } from '../QuestionScreen';

const { min, max } = numberQuestion;

function validate(raw: string): string | null {
  if (raw.trim() === '') return 'Please enter a number.';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    return `Please enter a whole number from ${String(min)} to ${String(max)}.`;
  }
  return null;
}

export function NumberQuestion() {
  const [raw, setRaw] = useState('');

  return (
    <QuestionScreen
      step="number"
      question={numberQuestion.text}
      hint={numberQuestion.hint}
      validationError={validate(raw)}
    >
      {({ questionId, errorId, showError }) => (
        <div className="flex items-center gap-3">
          <Input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
            }}
            aria-labelledby={questionId}
            aria-describedby={showError ? errorId : undefined}
            aria-invalid={showError}
            className="h-12 w-32 text-base"
          />
          <span className="text-muted-foreground">times</span>
        </div>
      )}
    </QuestionScreen>
  );
}
