import { z } from 'zod';
import type { QuestionType } from '../generated/prisma/enums.js';

// Shape of Question.config per question type. Shared by the API (validation on save), the
// builder UI and the respondent UI, so every type is defined exactly once.

const id = z.string().min(1);
const text = z.string().min(1);

export const optionSchema = z.object({
  id,
  label: text,
  /** Selecting it clears and blocks all other options ("None of these"). */
  exclusive: z.boolean().optional(),
});

/** A product, pack or picture shown to the respondent. */
export const stimulusSchema = z.object({
  id,
  label: text,
  imageUrl: z.string().min(1).optional(),
});

const uniqueIds = (items: { id: string }[]) =>
  new Set(items.map((item) => item.id)).size === items.length;
const options = z.array(optionSchema).min(2).refine(uniqueIds, 'Option ids must be unique');
const stimuli = z.array(stimulusSchema).min(1).refine(uniqueIds, 'Stimulus ids must be unique');

/**
 * Piping: show only the options (or grid rows) whose ids the respondent chose in an earlier
 * question (for a grid source: rows with at least one non-exclusive answer). Exclusive options
 * ("none of these") are always shown.
 */
export const pipeSchema = z.object({ question: z.string().min(1) });

// At least one option: piping can leave a single one on screen. Authoring requires two
// (checked in survey-definition.ts).
const choice = z.object({
  options: z.array(optionSchema).min(1).refine(uniqueIds, 'Option ids must be unique'),
  randomize: z.boolean().default(false),
  pipeFrom: pipeSchema.optional(),
});

const grid = z.object({
  rows: z.array(optionSchema).min(1).refine(uniqueIds, 'Row ids must be unique'),
  columns: options,
  randomizeRows: z.boolean().default(false),
  pipeFrom: pipeSchema.optional(),
});

const scaleEnds = { lowLabel: text, highLabel: text };

const range = z
  .object({ min: z.number(), max: z.number() })
  .refine(({ min, max }) => min < max, 'min must be below max');

export const questionConfigSchemas = {
  info: z.object({ body: text, imageUrl: z.string().min(1).optional() }),

  single_choice: choice,

  multi_choice: choice.extend({
    minSelected: z.int().min(1).default(1),
    maxSelected: z.int().min(1).optional(),
  }),

  grid_single: grid,

  grid_multi: grid,

  open_text: z.object({
    minLength: z.int().min(0).default(1),
    maxLength: z.int().min(1).max(5000),
  }),

  number: range.and(z.object({ integer: z.boolean().default(true), unit: z.string().optional() })),

  rating: range.and(z.object(scaleEnds)),

  /** One slider per item (e.g. per product); without items a single slider. */
  slider: range.and(
    z.object({
      ...scaleEnds,
      step: z.number().positive().default(1),
      items: stimuli.optional(),
      allowNotApplicable: z.boolean().default(false),
    }),
  ),

  semantic_differential: z.object({
    pairs: z
      .array(z.object({ id, left: text, right: text }))
      .min(1)
      .refine(uniqueIds, 'Pair ids must be unique'),
    points: z.int().min(3).max(11),
    stimulus: stimulusSchema.optional(),
  }),

  /** Best-worst scaling: `sets` is the experimental design, a list of item-id groups. */
  maxdiff: z
    .object({
      items: options,
      itemsPerSet: z.int().min(3),
      sets: z.array(z.array(id)).min(1),
    })
    .superRefine(({ items, itemsPerSet, sets }, ctx) => {
      const known = new Set(items.map((item) => item.id));
      sets.forEach((set, index) => {
        if (set.length !== itemsPerSet || new Set(set).size !== set.length) {
          ctx.addIssue({
            code: 'custom',
            message: `Set ${String(index + 1)} must have ${String(itemsPerSet)} distinct items`,
          });
        }
        if (set.some((itemId) => !known.has(itemId))) {
          ctx.addIssue({
            code: 'custom',
            message: `Set ${String(index + 1)} references an unknown item`,
          });
        }
      });
    }),

  constant_sum: z.object({ options, total: z.int().min(1) }),

  /**
   * Place stimuli on a canvas. With axes it is an anchored map; without, free projective
   * mapping. On phones the `mobile` variant is used instead of drag-and-drop.
   */
  mapping: z.object({
    stimuli: stimuli.refine((list) => list.length >= 2, 'At least two stimuli'),
    xAxis: z.object({ left: text, right: text }).optional(),
    yAxis: z.object({ bottom: text, top: text }).optional(),
    mobile: z.enum(['sorting', 'sliders']),
    groups: z.object({ min: z.int().min(2), max: z.int().min(2) }).optional(),
  }),

  /** Click a zone on an image, once per target (e.g. "where do you look for X?"). */
  click_map: z.object({
    imageUrl: z.string().min(1),
    imageAlt: text,
    /** Zone rectangles in percent of the image size. */
    zones: z
      .array(
        z.object({
          id,
          label: text,
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          width: z.number().positive().max(100),
          height: z.number().positive().max(100),
        }),
      )
      .min(1)
      .refine(uniqueIds, 'Zone ids must be unique'),
    targets: z.array(optionSchema).min(1).refine(uniqueIds, 'Target ids must be unique'),
  }),

  paired_comparison: z
    .object({
      items: stimuli,
      pairs: z.array(z.tuple([id, id])).min(1),
      /** Asked for every pair; the answer is one of the two items. */
      questions: z.array(optionSchema).min(1),
      randomizeSides: z.boolean().default(true),
    })
    .refine(({ items, pairs }) => {
      const known = new Set(items.map((item) => item.id));
      return pairs.every(([a, b]) => a !== b && known.has(a) && known.has(b));
    }, 'Pairs must reference two different known items'),

  /**
   * Show one stimulus for `exposureMs`, then ask a single-choice question and record the
   * response time. Several stimuli = split cells: `assignment` names the test group whose
   * value is the stimulus id to show (without it, the first stimulus is shown).
   */
  timed_exposure: z.object({
    stimuli,
    exposureMs: z.int().min(500).max(30_000),
    options,
    assignment: z.string().min(1).optional(),
  }),
} satisfies Record<QuestionType, z.ZodType>;

export type QuestionConfig<T extends QuestionType> = z.infer<(typeof questionConfigSchemas)[T]>;
/** What may be written before defaults are applied. */
export type QuestionConfigInput<T extends QuestionType> = z.input<
  (typeof questionConfigSchemas)[T]
>;

/** Validates a stored or submitted config against its question type. */
export function parseQuestionConfig<T extends QuestionType>(
  type: T,
  config: unknown,
): QuestionConfig<T> {
  return questionConfigSchemas[type].parse(config) as QuestionConfig<T>;
}
