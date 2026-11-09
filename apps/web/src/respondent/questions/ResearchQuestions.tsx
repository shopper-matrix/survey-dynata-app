import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OptionCard } from '@/components/survey/OptionCard';
import { SingleChoice } from './ChoiceQuestions';
import { field, without, type Item, type QuestionProps } from './types';

// Research question types from the questionnaire: info screens, MaxDiff, constant sum, mapping,
// click map, paired comparison and timed exposure. All work with touch, mouse and keyboard.

function Picture({ item, className = '' }: { item: Item; className?: string }) {
  return item.imageUrl ? (
    <img
      src={item.imageUrl}
      alt={item.label}
      className={`max-h-40 w-full object-contain ${className}`}
    />
  ) : null;
}

export function Info({ question, value, onChange }: QuestionProps) {
  const imageUrl = field<string | undefined>(question, 'imageUrl');
  // Reading the screen is the answer.
  useEffect(() => {
    if (!value) onChange({ seen: true });
  }, [value, onChange]);
  return (
    <>
      <p className="text-lg leading-relaxed whitespace-pre-line">
        {field<string>(question, 'body')}
      </p>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="mt-6 max-h-72 w-full object-contain" />
      ) : null}
    </>
  );
}

export function MaxDiff({ question, value, onChange, t }: QuestionProps) {
  const items = new Map(field<Item[]>(question, 'items').map((item) => [item.id, item]));
  const sets = field<string[][]>(question, 'sets');
  const answers = (value?.sets ?? []) as ({ best?: string; worst?: string } | undefined)[];

  function choose(index: number, side: 'best' | 'worst', id: string) {
    const next = sets.map((_, i) => ({ ...answers[i] }));
    const other = side === 'best' ? 'worst' : 'best';
    const current = next[index] ?? {};
    next[index] = { ...(current[other] === id ? {} : { [other]: current[other] }), [side]: id };
    onChange({ sets: next });
  }

  return (
    <div className="grid gap-6">
      {sets.map((set, index) => (
        <fieldset key={set.join('-')} className="rounded-lg border p-4">
          <legend className="px-1 text-sm text-muted-foreground">
            {t.setOf(index + 1, sets.length)}
          </legend>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2">
            <span />
            <span className="text-center text-xs font-medium">{t.best}</span>
            <span className="text-center text-xs font-medium">{t.worst}</span>
            {set.map((id) => {
              const label = items.get(id)?.label ?? id;
              return [
                <span key={`${id}-label`}>{label}</span>,
                ...(['best', 'worst'] as const).map((side) => (
                  <label
                    key={`${id}-${side}`}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                  >
                    <input
                      type="radio"
                      name={`${question.code}-${String(index)}-${side}`}
                      checked={answers[index]?.[side] === id}
                      onChange={() => {
                        choose(index, side, id);
                      }}
                      aria-label={`${side === 'best' ? t.best : t.worst}: ${label}`}
                      className="size-5 accent-primary"
                    />
                  </label>
                )),
              ];
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function ConstantSum({ question, value, onChange, labelledBy, t }: QuestionProps) {
  const options = field<Item[]>(question, 'options');
  const total = field<number>(question, 'total');
  const points = (value?.points ?? {}) as Record<string, number>;
  const used = Object.values(points).reduce((sum, n) => sum + n, 0);
  const left = total - used;
  return (
    <div role="group" aria-labelledby={labelledBy}>
      <div className="grid gap-3">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-12 items-center justify-between gap-4 rounded-lg border bg-card px-4 py-2"
          >
            <span>{option.label}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={total}
              value={points[option.id] ?? ''}
              onChange={(event) => {
                const raw = event.target.value;
                onChange({
                  points:
                    raw === ''
                      ? without(points, option.id)
                      : { ...points, [option.id]: Math.max(0, Math.floor(Number(raw))) },
                });
              }}
              className="h-11 w-20 text-right text-base"
            />
          </label>
        ))}
      </div>
      <p
        aria-live="polite"
        className={`mt-3 text-sm font-medium ${left < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {left >= 0 ? t.pointsLeft(left) : t.pointsOver(-left)}
      </p>
    </div>
  );
}

/**
 * Mapping: with axes each item gets two sliders (left–right, bottom–top), stored as positions
 * from 0 to 1; without axes items are sorted into groups. Accessible on every device.
 */
export function Mapping({ question, value, onChange, t }: QuestionProps) {
  const stimuli = field<Item[]>(question, 'stimuli');
  const xAxis = field<{ left: string; right: string } | undefined>(question, 'xAxis');
  const yAxis = field<{ bottom: string; top: string } | undefined>(question, 'yAxis');
  const groups = field<{ min: number; max: number } | undefined>(question, 'groups');

  if (!xAxis) {
    const count = groups?.max ?? Math.min(6, stimuli.length);
    const assigned = new Map<string, number>();
    ((value?.groups ?? []) as string[][]).forEach((group, index) => {
      for (const id of group) assigned.set(id, index + 1);
    });
    const setGroup = (id: string, group: number) => {
      assigned.set(id, group);
      const next: string[][] = Array.from({ length: count }, () => []);
      for (const [item, g] of assigned) next[g - 1]?.push(item);
      onChange({ groups: next.filter((g) => g.length > 0) });
    };
    return (
      <div className="grid gap-4">
        {stimuli.map((stimulus) => (
          <div key={stimulus.id} className="rounded-lg border p-3">
            <Picture item={stimulus} className="mb-2" />
            <p className="font-medium">{stimulus.label}</p>
            <div
              role="radiogroup"
              aria-label={t.groupFor(stimulus.label)}
              className="mt-2 flex flex-wrap gap-2"
            >
              {Array.from({ length: count }, (_, i) => i + 1).map((group) => (
                <button
                  key={group}
                  type="button"
                  role="radio"
                  aria-checked={assigned.get(stimulus.id) === group}
                  onClick={() => {
                    setGroup(stimulus.id, group);
                  }}
                  className="min-h-11 rounded-md border px-3 text-sm aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground"
                >
                  {t.group(group)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const positions = (value?.positions ?? {}) as Record<string, { x?: number; y?: number }>;
  const place = (id: string, axis: 'x' | 'y', point: number) => {
    // Without a vertical axis every item sits on the middle line.
    const base = yAxis ? {} : { y: 0.5 };
    const next = { ...positions, [id]: { ...base, ...positions[id], [axis]: point } };
    onChange({ positions: next, input: 'sliders' });
  };
  const axes = [
    { axis: 'x' as const, low: xAxis.left, high: xAxis.right, name: t.horizontal },
    ...(yAxis
      ? [{ axis: 'y' as const, low: yAxis.bottom, high: yAxis.top, name: t.vertical }]
      : []),
  ];
  return (
    <div className="grid gap-6">
      {stimuli.map((stimulus) => (
        <div key={stimulus.id} className="rounded-lg border p-4">
          <Picture item={stimulus} className="mb-2" />
          <p className="font-medium">{stimulus.label}</p>
          {axes.map(({ axis, low, high, name }) => {
            const current = positions[stimulus.id]?.[axis];
            return (
              <div key={axis} className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={1 / 6}
                  value={current ?? 0.5}
                  aria-label={`${stimulus.label}: ${name}`}
                  aria-valuetext={
                    current === undefined
                      ? '–'
                      : `${low} ${String(Math.round(current * 6) + 1)}/7 ${high}`
                  }
                  onChange={(event) => {
                    place(stimulus.id, axis, Math.round(Number(event.target.value) * 100) / 100);
                  }}
                  className={`h-11 w-full cursor-pointer accent-primary ${current === undefined ? 'opacity-50' : ''}`}
                />
                <div className="flex justify-between gap-4 text-sm text-muted-foreground">
                  <span>{low}</span>
                  <span className="text-right">{high}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Click map: per target, tap a zone on the picture (zones are labelled buttons). */
export function ClickMap({ question, value, onChange, t }: QuestionProps) {
  const zones = field<(Item & { x: number; y: number; width: number; height: number })[]>(
    question,
    'zones',
  );
  const targets = field<Item[]>(question, 'targets');
  const clicks = (value?.clicks ?? {}) as Record<string, string>;
  return (
    <div className="grid gap-8">
      {targets.map((target) => (
        <div key={target.id}>
          <p className="font-medium">{t.whereFor(target.label)}</p>
          <div className="relative mt-2 overflow-hidden rounded-lg border">
            <img
              src={field<string>(question, 'imageUrl')}
              alt={field<string>(question, 'imageAlt')}
              className="block w-full"
            />
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                aria-pressed={clicks[target.id] === zone.id}
                aria-label={`${target.label}: ${zone.label}`}
                onClick={() => {
                  onChange({ clicks: { ...clicks, [target.id]: zone.id } });
                }}
                className="absolute border-2 border-transparent hover:bg-primary/10 focus-visible:border-ring aria-pressed:border-primary aria-pressed:bg-primary/25"
                style={{
                  left: `${String(zone.x)}%`,
                  top: `${String(zone.y)}%`,
                  width: `${String(zone.width)}%`,
                  height: `${String(zone.height)}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PairedComparison({ question, value, onChange, t }: QuestionProps) {
  const items = new Map(field<Item[]>(question, 'items').map((item) => [item.id, item]));
  const pairs = field<[string, string][]>(question, 'pairs');
  const questions = field<Item[]>(question, 'questions');
  const choices = (value?.choices ?? []) as ({ answers: Record<string, string> } | undefined)[];

  function pick(index: number, questionId: string, itemId: string) {
    const next = pairs.map((pair, i) => ({ pair, answers: { ...choices[i]?.answers } }));
    const choice = next[index];
    if (choice) choice.answers[questionId] = itemId;
    onChange({ choices: next });
  }

  return (
    <div className="grid gap-8">
      {pairs.map((pair, index) => (
        <section
          key={pair.join('-')}
          aria-label={t.pair(index + 1, pairs.length)}
          className="rounded-lg border p-4"
        >
          <p className="text-sm text-muted-foreground">{t.pair(index + 1, pairs.length)}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {pair.map((id) => {
              const item = items.get(id) ?? { id, label: id };
              return (
                <figure key={id} className="text-center">
                  <Picture item={item} />
                  <figcaption className="mt-1 text-sm font-medium">{item.label}</figcaption>
                </figure>
              );
            })}
          </div>
          {questions.map((q) => (
            <div key={q.id} className="mt-4">
              <p id={`${question.code}-${String(index)}-${q.id}`} className="font-medium">
                {q.label}
              </p>
              <RadioGroup
                value={choices[index]?.answers[q.id] ?? ''}
                onValueChange={(id) => {
                  pick(index, q.id, id);
                }}
                aria-labelledby={`${question.code}-${String(index)}-${q.id}`}
                className="mt-2 grid-cols-2 gap-3"
              >
                {pair.map((id) => {
                  const inputId = `${question.code}-${String(index)}-${q.id}-${id}`;
                  return (
                    <OptionCard
                      key={id}
                      htmlFor={inputId}
                      label={items.get(id)?.label ?? id}
                      control={<RadioGroupItem id={inputId} value={id} />}
                    />
                  );
                })}
              </RadioGroup>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Timed exposure: the picture is shown once for `exposureMs`, then hidden; the respondent
 * answers a single-choice question and the time from hiding to answering is recorded.
 */
export function TimedExposure(props: QuestionProps) {
  const { question, value, onChange, t } = props;
  const stimulus = field<Item[]>(question, 'stimuli')[0];
  const exposureMs = field<number>(question, 'exposureMs');
  const [phase, setPhase] = useState<'ready' | 'showing' | 'answering'>(
    value ? 'answering' : 'ready',
  );
  const hiddenAt = useRef(0);

  useEffect(() => {
    if (phase !== 'showing') return;
    const timer = setTimeout(() => {
      hiddenAt.current = performance.now();
      setPhase('answering');
    }, exposureMs);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, exposureMs]);

  if (!stimulus) return null;
  if (phase === 'ready') {
    return (
      <div className="rounded-lg border p-4">
        <p>{t.lookClosely}</p>
        <button
          type="button"
          onClick={() => {
            setPhase('showing');
          }}
          className="mt-4 min-h-12 rounded-md bg-primary px-6 font-medium text-primary-foreground"
        >
          {t.continue}
        </button>
      </div>
    );
  }
  if (phase === 'showing') {
    return <Picture item={stimulus} className="max-h-80" />;
  }
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">{t.showAgainNotPossible}</p>
      <SingleChoice
        {...props}
        value={value ? { optionId: value.optionId } : undefined}
        onChange={(choice) => {
          onChange(
            { stimulusId: stimulus.id, optionId: choice.optionId },
            { responseTimeMs: Math.round(performance.now() - hiddenAt.current) },
          );
        }}
      />
    </>
  );
}
