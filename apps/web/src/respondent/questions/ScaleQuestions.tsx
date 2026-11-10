import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { field, type Item, type QuestionProps } from './types';

export function OpenText({ question, value, onChange, labelledBy, describedBy }: QuestionProps) {
  const maxLength = field<number>(question, 'maxLength');
  const text = typeof value?.text === 'string' ? value.text : '';
  return (
    <>
      <Textarea
        value={text}
        maxLength={maxLength}
        rows={6}
        onChange={(event) => {
          onChange({ text: event.target.value });
        }}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={describedBy !== undefined}
        className="text-base"
      />
      <p className="mt-2 text-right text-sm text-muted-foreground" aria-live="polite">
        {text.length} / {maxLength}
      </p>
    </>
  );
}

export function NumberInput({ question, value, onChange, labelledBy, describedBy }: QuestionProps) {
  const unit = field<string | undefined>(question, 'unit');
  const current = typeof value?.value === 'number' ? String(value.value) : '';
  return (
    <div className="flex items-center gap-3">
      <Input
        type="number"
        inputMode="decimal"
        min={field<number>(question, 'min')}
        max={field<number>(question, 'max')}
        defaultValue={current}
        onChange={(event) => {
          const raw = event.target.value.trim();
          onChange(raw === '' ? {} : { value: Number(raw) });
        }}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={describedBy !== undefined}
        className="h-12 w-36 text-base"
      />
      {unit ? <span className="text-muted-foreground">{unit}</span> : null}
    </div>
  );
}

/** Numbered buttons in one row from 640 px, wrapping on phones; keyboard: arrow keys. */
function PointScale({
  name,
  points,
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  name: string;
  points: number[];
  value: number | undefined;
  onChange: (point: number) => void;
  labelledBy: string;
  describedBy?: string | undefined;
}) {
  return (
    <RadioGroup
      value={value === undefined ? '' : String(value)}
      onValueChange={(point) => {
        onChange(Number(point));
      }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${String(Math.min(points.length, 7))}, minmax(0, 1fr))`,
      }}
    >
      {points.map((point) => {
        const id = `${name}-${String(point)}`;
        return (
          <label
            key={point}
            htmlFor={id}
            className="relative flex h-12 cursor-pointer items-center justify-center rounded-lg border bg-card text-base font-medium hover:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground"
          >
            <RadioGroupItem id={id} value={String(point)} className="sr-only" />
            {point}
          </label>
        );
      })}
    </RadioGroup>
  );
}

const range = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i);

export function Rating({ question, value, onChange, labelledBy, describedBy }: QuestionProps) {
  const min = field<number>(question, 'min');
  const max = field<number>(question, 'max');
  return (
    <>
      <PointScale
        name={question.code}
        points={range(min, max)}
        value={typeof value?.value === 'number' ? value.value : undefined}
        onChange={(point) => {
          onChange({ value: point });
        }}
        labelledBy={labelledBy}
        describedBy={describedBy}
      />
      <div className="mt-2 flex justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {min} = {field<string>(question, 'lowLabel')}
        </span>
        <span className="text-right">
          {max} = {field<string>(question, 'highLabel')}
        </span>
      </div>
    </>
  );
}

/** One slider per item (or a single one); untouched sliders have no answer yet. */
export function Slider({ question, value, onChange, labelledBy, t }: QuestionProps) {
  const min = field<number>(question, 'min');
  const max = field<number>(question, 'max');
  const step = field<number | undefined>(question, 'step') ?? 1;
  const items = field<Item[] | undefined>(question, 'items');
  const allowNotApplicable = field<boolean | undefined>(question, 'allowNotApplicable') === true;
  const values = (value?.values ?? {}) as Record<string, number | null>;
  const set = (id: string, point: number | null) => {
    onChange({ values: { ...values, [id]: point } });
  };

  if (!items) {
    const single = typeof value?.value === 'number' ? value.value : undefined;
    return (
      <SliderRow
        id={question.code}
        label=""
        labelledBy={labelledBy}
        min={min}
        max={max}
        step={step}
        value={single}
        lowLabel={field(question, 'lowLabel')}
        highLabel={field(question, 'highLabel')}
        onChange={(point) => {
          onChange({ value: point });
        }}
      />
    );
  }
  return (
    <div className="grid gap-6">
      {items.map((item) => (
        <div key={item.id}>
          <SliderRow
            id={`${question.code}-${item.id}`}
            label={item.label}
            min={min}
            max={max}
            step={step}
            value={values[item.id] ?? undefined}
            disabled={values[item.id] === null}
            lowLabel={field(question, 'lowLabel')}
            highLabel={field(question, 'highLabel')}
            onChange={(point) => {
              set(item.id, point);
            }}
          />
          {allowNotApplicable ? (
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                checked={values[item.id] === null}
                onCheckedChange={(checked) => {
                  set(item.id, checked === true ? null : Math.round((min + max) / 2));
                }}
              />
              {t.cannotJudge}
            </label>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SliderRow(props: {
  id: string;
  label: string;
  labelledBy?: string;
  min: number;
  max: number;
  step: number;
  value: number | undefined;
  disabled?: boolean;
  lowLabel: string;
  highLabel: string;
  onChange: (point: number) => void;
}) {
  const labelId = useId();
  return (
    <div>
      {props.label ? (
        <p id={labelId} className="font-medium">
          {props.label}
        </p>
      ) : null}
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value ?? Math.round((props.min + props.max) / 2)}
        disabled={props.disabled}
        aria-labelledby={props.labelledBy ?? labelId}
        aria-valuetext={props.value === undefined ? '–' : String(props.value)}
        onChange={(event) => {
          props.onChange(Number(event.target.value));
        }}
        className={`mt-3 h-11 w-full cursor-pointer accent-primary ${props.value === undefined ? 'opacity-50' : ''}`}
      />
      <div className="flex justify-between gap-4 text-sm text-muted-foreground">
        <span>{props.lowLabel}</span>
        <span aria-hidden className="font-medium text-foreground">
          {props.value ?? ''}
        </span>
        <span className="text-right">{props.highLabel}</span>
      </div>
    </div>
  );
}

export function SemanticDifferential({ question, value, onChange, describedBy }: QuestionProps) {
  const pairs = field<{ id: string; left: string; right: string }[]>(question, 'pairs');
  const points = range(1, field<number>(question, 'points'));
  const values = (value?.values ?? {}) as Record<string, number>;
  return (
    <div className="grid gap-6">
      {pairs.map((pair) => {
        const labelId = `${question.code}-${pair.id}-label`;
        return (
          <div key={pair.id}>
            <p id={labelId} className="flex justify-between gap-4 font-medium">
              <span>{pair.left}</span>
              <span className="text-right">{pair.right}</span>
            </p>
            <div className="mt-2">
              <PointScale
                name={`${question.code}-${pair.id}`}
                points={points}
                value={values[pair.id]}
                onChange={(point) => {
                  onChange({ values: { ...values, [pair.id]: point } });
                }}
                labelledBy={labelId}
                describedBy={describedBy && values[pair.id] === undefined ? describedBy : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
