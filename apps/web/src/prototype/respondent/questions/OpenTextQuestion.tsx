import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { openQuestion } from '../../fake-data';
import { QuestionScreen } from '../QuestionScreen';

export function OpenTextQuestion() {
  const [text, setText] = useState('');

  return (
    <QuestionScreen
      step="open"
      question={openQuestion.text}
      hint={openQuestion.hint}
      validationError={text.trim().length >= 2 ? null : 'Please write a short answer.'}
    >
      {({ questionId, errorId, showError }) => (
        <>
          <Textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            maxLength={openQuestion.maxLength}
            rows={6}
            aria-labelledby={questionId}
            aria-describedby={showError ? errorId : undefined}
            aria-invalid={showError}
            className="text-base"
          />
          <p className="mt-2 text-right text-sm text-muted-foreground">
            {text.length} / {openQuestion.maxLength}
          </p>
        </>
      )}
    </QuestionScreen>
  );
}
