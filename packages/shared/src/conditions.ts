import { z } from 'zod';

// Conditions on earlier answers, used by screening rules, quota cells and display logic.
// Only the format lives here; evaluation is the screening engine's job (DSA-307).

const question = z.string().min(1);
const scalar = z.union([z.string(), z.number()]);

const comparisonSchema = z.discriminatedUnion('op', [
  z.object({ question, op: z.literal('equals'), value: scalar }),
  z.object({ question, op: z.literal('not_equals'), value: scalar }),
  z.object({ question, op: z.literal('in'), value: z.array(scalar).min(1) }),
  z.object({ question, op: z.literal('not_in'), value: z.array(scalar).min(1) }),
  z.object({ question, op: z.literal('lt'), value: z.number() }),
  z.object({ question, op: z.literal('gt'), value: z.number() }),
  z.object({
    question,
    op: z.literal('between'),
    value: z.object({ min: z.number(), max: z.number() }),
  }),
  /** Multiple choice: at least one of the listed options was selected. */
  z.object({ question, op: z.literal('includes_any'), value: z.array(z.string()).min(1) }),
]);

export type Comparison = z.infer<typeof comparisonSchema>;
export type Condition = Comparison | { all: Condition[] } | { any: Condition[] };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    comparisonSchema,
    z.object({ all: z.array(conditionSchema).min(1) }),
    z.object({ any: z.array(conditionSchema).min(1) }),
  ]),
);

/** Codes of every question a condition refers to, e.g. to check they exist. */
export function referencedQuestions(condition: Condition): string[] {
  if ('all' in condition) return condition.all.flatMap(referencedQuestions);
  if ('any' in condition) return condition.any.flatMap(referencedQuestions);
  return [condition.question];
}
