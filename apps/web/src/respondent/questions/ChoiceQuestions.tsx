import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OptionCard } from '@/components/survey/OptionCard';
import { field, type Item, type QuestionProps } from './types';

const optionId = (question: QuestionProps['question'], id: string) => `${question.code}-${id}`;

export function SingleChoice({
  question,
  value,
  onChange,
  labelledBy,
  describedBy,
}: QuestionProps) {
  const options = field<Item[]>(question, 'options');
  return (
    <RadioGroup
      value={typeof value?.optionId === 'string' ? value.optionId : ''}
      onValueChange={(id) => {
        onChange({ optionId: id });
      }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={describedBy !== undefined}
      className="gap-3"
    >
      {options.map((option) => (
        <OptionCard
          key={option.id}
          htmlFor={optionId(question, option.id)}
          label={option.label}
          control={<RadioGroupItem id={optionId(question, option.id)} value={option.id} />}
        />
      ))}
    </RadioGroup>
  );
}

/** Multiple choice; an exclusive option ("none of these") clears the others and vice versa. */
export function MultiChoice({ question, value, onChange, labelledBy, describedBy }: QuestionProps) {
  const options = field<Item[]>(question, 'options');
  const selected = Array.isArray(value?.optionIds) ? (value.optionIds as string[]) : [];
  const exclusive = new Set(options.filter((o) => o.exclusive).map((o) => o.id));

  function toggle(id: string, checked: boolean) {
    let next = checked ? [...selected, id] : selected.filter((item) => item !== id);
    if (checked) next = exclusive.has(id) ? [id] : next.filter((item) => !exclusive.has(item));
    onChange({ optionIds: next });
  }

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="grid gap-3"
    >
      {options.map((option) => (
        <OptionCard
          key={option.id}
          htmlFor={optionId(question, option.id)}
          label={option.label}
          control={
            <Checkbox
              id={optionId(question, option.id)}
              checked={selected.includes(option.id)}
              onCheckedChange={(checked) => {
                toggle(option.id, checked === true);
              }}
            />
          }
        />
      ))}
    </div>
  );
}
