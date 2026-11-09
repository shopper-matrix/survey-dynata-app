import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { storesQuestion } from '../../fake-data';
import { OptionCard } from '@/components/survey/OptionCard';
import { QuestionScreen } from '../QuestionScreen';

const EXCLUSIVE_OPTION = 'none';

export function MultiChoiceQuestion() {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      if (!checked) return current.filter((item) => item !== id);
      // "None of these" cannot be combined with other answers.
      if (id === EXCLUSIVE_OPTION) return [id];
      return [...current.filter((item) => item !== EXCLUSIVE_OPTION), id];
    });
  }

  return (
    <QuestionScreen
      step="multi"
      question={storesQuestion.text}
      hint={storesQuestion.hint}
      validationError={selected.length > 0 ? null : 'Please choose at least one option.'}
    >
      {({ questionId, errorId, showError }) => (
        <div
          role="group"
          aria-labelledby={questionId}
          aria-describedby={showError ? errorId : undefined}
          className="grid gap-3"
        >
          {storesQuestion.options.map((option) => (
            <OptionCard
              key={option.id}
              htmlFor={`store-${option.id}`}
              label={option.label}
              control={
                <Checkbox
                  id={`store-${option.id}`}
                  checked={selected.includes(option.id)}
                  onCheckedChange={(checked) => {
                    toggle(option.id, checked === true);
                  }}
                />
              }
            />
          ))}
        </div>
      )}
    </QuestionScreen>
  );
}
