import { z } from 'zod';
import type { QuestionType } from './generated/prisma/enums.js';
import { parseQuestionConfig } from './questions/config.js';

// Answer value per question type, validated against the question's config as presented to the
// respondent (after piping). Shared by the answer API and the respondent UI.

const id = z.string().min(1);

/** The ids are known and unique; an exclusive option ("none of these") stands alone. */
function choiceIds(
  ids: string[],
  options: { id: string; exclusive?: boolean | undefined }[],
  ctx: z.RefinementCtx,
): void {
  const known = new Map(options.map((option) => [option.id, option.exclusive === true]));
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate choice' });
  for (const choice of ids) {
    if (!known.has(choice)) ctx.addIssue({ code: 'custom', message: `Unknown option ${choice}` });
  }
  if (ids.length > 1 && ids.some((choice) => known.get(choice))) {
    ctx.addIssue({ code: 'custom', message: 'An exclusive option cannot be combined with others' });
  }
}

/** A record with exactly the given keys. */
function everyKey<T extends z.ZodType>(keys: string[], value: T) {
  return z.record(z.string(), value).superRefine((record, ctx) => {
    const given = Object.keys(record);
    for (const key of keys) {
      if (!(key in record)) ctx.addIssue({ code: 'custom', message: `Missing answer for ${key}` });
    }
    for (const key of given) {
      if (!keys.includes(key)) ctx.addIssue({ code: 'custom', message: `Unknown item ${key}` });
    }
  });
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);
const inRange = (min: number, max: number) => z.number().min(min).max(max);

/** Zod schema for the answer to a question with this type and (presented) config. */
export function answerSchema(type: QuestionType, rawConfig: unknown): z.ZodType {
  switch (type) {
    case 'info':
      return z.strictObject({ seen: z.literal(true) });

    case 'single_choice': {
      const { options } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({ optionId: z.enum(ids(options) as [string, ...string[]]) });
    }

    case 'multi_choice': {
      const config = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        optionIds: z
          .array(id)
          .min(1)
          .superRefine((choices, ctx) => {
            choiceIds(choices, config.options, ctx);
            const exclusive = choices.some(
              (choice) => config.options.find((o) => o.id === choice)?.exclusive,
            );
            if (!exclusive && choices.length < config.minSelected) {
              ctx.addIssue({
                code: 'custom',
                message: `Choose at least ${String(config.minSelected)}`,
              });
            }
            if (config.maxSelected !== undefined && choices.length > config.maxSelected) {
              ctx.addIssue({
                code: 'custom',
                message: `Choose at most ${String(config.maxSelected)}`,
              });
            }
          }),
      });
    }

    case 'grid_single': {
      const { rows, columns } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        rows: everyKey(ids(rows), z.enum(ids(columns) as [string, ...string[]])),
      });
    }

    case 'grid_multi': {
      const { rows, columns } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        rows: everyKey(
          ids(rows),
          z
            .array(id)
            .min(1)
            .superRefine((choices, ctx) => {
              choiceIds(choices, columns, ctx);
            }),
        ),
      });
    }

    case 'open_text': {
      const { minLength, maxLength } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        text: z
          .string()
          .max(maxLength)
          .refine(
            (text) => text.trim().length >= minLength,
            `At least ${String(minLength)} characters`,
          ),
      });
    }

    case 'number': {
      const config = parseQuestionConfig(type, rawConfig);
      const value = inRange(config.min, config.max);
      return z.strictObject({ value: config.integer ? value.int() : value });
    }

    case 'rating': {
      const { min, max } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({ value: inRange(min, max).int() });
    }

    case 'slider': {
      const config = parseQuestionConfig(type, rawConfig);
      const point = inRange(config.min, config.max);
      if (!config.items) return z.strictObject({ value: point });
      return z.strictObject({
        values: everyKey(ids(config.items), config.allowNotApplicable ? point.nullable() : point),
      });
    }

    case 'semantic_differential': {
      const { pairs, points } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({ values: everyKey(ids(pairs), inRange(1, points).int()) });
    }

    case 'maxdiff': {
      const { sets } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        sets: z
          .array(z.strictObject({ best: id, worst: id }))
          .length(sets.length)
          .superRefine((choices, ctx) => {
            choices.forEach(({ best, worst }, index) => {
              const set = sets[index] ?? [];
              if (best === worst || !set.includes(best) || !set.includes(worst)) {
                ctx.addIssue({
                  code: 'custom',
                  message: `Set ${String(index + 1)}: best and worst must be two different items of the set`,
                });
              }
            });
          }),
      });
    }

    case 'constant_sum': {
      const { options, total } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        points: z
          .partialRecord(z.enum(ids(options) as [string, ...string[]]), z.int().min(0))
          .refine(
            (points) =>
              Object.values(points).reduce((sum: number, value) => sum + (value ?? 0), 0) === total,
            `Points must add up to ${String(total)}`,
          ),
      });
    }

    case 'mapping': {
      const config = parseQuestionConfig(type, rawConfig);
      const stimuli = ids(config.stimuli);
      const position = z.strictObject({ x: inRange(0, 1), y: inRange(0, 1) });
      const placed = z.strictObject({
        positions: everyKey(stimuli, position),
        input: z.enum(['drag', 'sliders']).optional(),
      });
      const sorted = z.strictObject({
        groups: z
          .array(z.array(id).min(1))
          .min(config.groups?.min ?? 1)
          .max(config.groups?.max ?? stimuli.length)
          .superRefine((groups, ctx) => {
            const all = groups.flat();
            if (all.length !== stimuli.length || stimuli.some((s) => !all.includes(s))) {
              ctx.addIssue({ code: 'custom', message: 'Every item must be in exactly one group' });
            }
          }),
      });
      return z.union([placed, sorted]);
    }

    case 'click_map': {
      const { zones, targets } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        clicks: everyKey(ids(targets), z.enum(ids(zones) as [string, ...string[]])),
      });
    }

    case 'paired_comparison': {
      const { pairs, questions } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        choices: z
          .array(
            z.strictObject({
              pair: z.tuple([id, id]),
              answers: everyKey(ids(questions), id),
            }),
          )
          .length(pairs.length)
          .superRefine((choices, ctx) => {
            choices.forEach((choice, index) => {
              const [a, b] = pairs[index] ?? [];
              if (choice.pair[0] !== a || choice.pair[1] !== b) {
                ctx.addIssue({
                  code: 'custom',
                  message: `Pair ${String(index + 1)} does not match`,
                });
              }
              for (const picked of Object.values(choice.answers)) {
                if (!choice.pair.includes(picked)) {
                  ctx.addIssue({
                    code: 'custom',
                    message: `Pair ${String(index + 1)}: pick one of the two items`,
                  });
                }
              }
            });
          }),
      });
    }

    case 'timed_exposure': {
      const { stimuli, options } = parseQuestionConfig(type, rawConfig);
      return z.strictObject({
        stimulusId: z.enum(ids(stimuli) as [string, ...string[]]),
        optionId: z.enum(ids(options) as [string, ...string[]]),
      });
    }
  }
}

export type AnswerValue = Record<string, unknown>;

export function parseAnswer(type: QuestionType, config: unknown, value: unknown): AnswerValue {
  return answerSchema(type, config).parse(value) as AnswerValue;
}
