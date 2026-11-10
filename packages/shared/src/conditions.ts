import { z } from 'zod';

// Conditions on earlier answers and on random test-group assignments, used by screening rules,
// quota cells and display logic. Only the format lives here; evaluation is the screening
// engine's job (DSA-307).

const question = z.string().min(1);
const scalar = z.union([z.string(), z.number()]);
const ids = z.array(z.string()).min(1);

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
  z.object({ question, op: z.literal('includes_any'), value: ids }),
  /** Multiple choice: none of the listed options was selected. */
  z.object({ question, op: z.literal('includes_none'), value: ids }),
]);

/** Condition on the respondent's random assignment, e.g. the split cell they were put in. */
const assignmentComparisonSchema = z.object({
  assignment: z.string().min(1),
  op: z.enum(['equals', 'in']),
  value: z.union([z.string(), ids]),
});

export type Comparison = z.infer<typeof comparisonSchema>;
export type AssignmentComparison = z.infer<typeof assignmentComparisonSchema>;
export type Condition =
  Comparison | AssignmentComparison | { all: Condition[] } | { any: Condition[] };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    comparisonSchema,
    assignmentComparisonSchema,
    z.object({ all: z.array(conditionSchema).min(1) }),
    z.object({ any: z.array(conditionSchema).min(1) }),
  ]),
);

function leaves(condition: Condition): (Comparison | AssignmentComparison)[] {
  if ('all' in condition) return condition.all.flatMap(leaves);
  if ('any' in condition) return condition.any.flatMap(leaves);
  return [condition];
}

/** Codes of every question a condition refers to, e.g. to check they exist. */
export function referencedQuestions(condition: Condition): string[] {
  return leaves(condition).flatMap((leaf) => ('question' in leaf ? [leaf.question] : []));
}

/** Names of every assignment a condition refers to. */
export function referencedAssignments(condition: Condition): string[] {
  return leaves(condition).flatMap((leaf) => ('assignment' in leaf ? [leaf.assignment] : []));
}
