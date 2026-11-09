import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ageQuestion } from '../../fake-data';
import { OptionCard } from '@/components/survey/OptionCard';
import { QuestionScreen } from '../QuestionScreen';

/** Single choice; doubles as the screener ("Under 18" screens out). */
export function SingleChoiceQuestion() {
  const [value, setValue] = useState('');
  const screensOut = value === ageQuestion.screenOutOptionId;

  return (
    <QuestionScreen
      step="single"
      question={ageQuestion.text}
      hint={ageQuestion.hint}
      validationError={value ? null : 'Please choose one option.'}
      {...(screensOut ? { nextPath: '/survey/end/screenout' } : {})}
    >
      {({ questionId, errorId, showError }) => (
        <RadioGroup
          value={value}
          onValueChange={setValue}
          aria-labelledby={questionId}
          aria-describedby={showError ? errorId : undefined}
          aria-invalid={showError}
          className="gap-3"
        >
          {ageQuestion.options.map((option) => (
            <OptionCard
              key={option.id}
              htmlFor={`age-${option.id}`}
              label={option.label}
              control={<RadioGroupItem id={`age-${option.id}`} value={option.id} />}
            />
          ))}
        </RadioGroup>
      )}
    </QuestionScreen>
  );
}
