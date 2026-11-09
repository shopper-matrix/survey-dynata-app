import { z } from 'zod';
import { QuestionType, QuotaKind } from './generated/prisma/enums.js';
import {
  conditionSchema,
  referencedAssignments,
  referencedQuestions,
  type Condition,
} from './conditions.js';
import { questionConfigSchemas } from './questions/config.js';

// File format for a whole survey (`pnpm survey:import <file>`): blocks, questions, screening,
// quotas and random test-group assignments. Validated completely before anything is written.

const code = z.string().min(1).max(40);

/** A random assignment, e.g. a split cell: each respondent gets `pick` of the `values`. */
export const assignmentSchema = z
  .object({
    name: code,
    values: z.array(z.string().min(1)).min(2),
    /** How many values each respondent gets (incomplete-block designs pick more than one). */
    pick: z.int().min(1).default(1),
    /** Question codes to balance the assignment within (stratified randomisation). */
    stratifyBy: z.array(code).default([]),
  })
  .refine(({ values, pick }) => pick < values.length, 'pick must be below the number of values');

export const questionDefinitionSchema = z
  .object({
    code,
    type: z.enum(QuestionType),
    text: z.string().min(1),
    config: z.unknown(),
    isScreener: z.boolean().default(false),
    isAttentionCheck: z.boolean().default(false),
    /** Show the question only when this matches. */
    displayLogic: conditionSchema.optional(),
    /** End the survey as screen-out when this matches. */
    screenOut: conditionSchema.optional(),
    /** Programming notes for what the engine can't express yet. */
    notes: z.array(z.string().min(1)).default([]),
  })
  .transform((question, ctx) => {
    const parsed = questionConfigSchemas[question.type].safeParse(question.config);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ ...issue, path: ['config', ...issue.path] });
      }
      return z.NEVER;
    }
    return { ...question, config: parsed.data };
  });

export const blockDefinitionSchema = z.object({
  code,
  title: z.string().min(1),
  rotationGroup: z.string().min(1).optional(),
  displayLogic: conditionSchema.optional(),
  questions: z.array(questionDefinitionSchema).min(1),
});

export const quotaDefinitionSchema = z.object({
  name: z.string().min(1),
  conditions: conditionSchema,
  target: z.int().min(1),
  kind: z.enum(QuotaKind).default('cap'),
});

export const surveyDefinitionSchema = z
  .object({
    survey: z.object({
      /** Fixed ID so a re-import replaces the same survey. */
      id: z.uuid(),
      title: z.string().min(1),
      language: z.string().min(2).max(10),
      targetCompletes: z.int().min(1),
      notes: z.array(z.string().min(1)).default([]),
    }),
    assignments: z.array(assignmentSchema).default([]),
    blocks: z.array(blockDefinitionSchema).min(1),
    quotas: z.array(quotaDefinitionSchema).default([]),
  })
  .superRefine((definition, ctx) => {
    const questions = definition.blocks.flatMap((block) => block.questions);
    const codes = new Set<string>();
    for (const question of questions) {
      if (codes.has(question.code)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate question code ${question.code}` });
      }
      codes.add(question.code);
    }
    const blockCodes = definition.blocks.map((block) => block.code);
    if (new Set(blockCodes).size !== blockCodes.length) {
      ctx.addIssue({ code: 'custom', message: 'Block codes must be unique' });
    }
    const assignments = new Set(definition.assignments.map((assignment) => assignment.name));

    const check = (where: string, condition: Condition | undefined) => {
      if (!condition) return;
      for (const ref of referencedQuestions(condition)) {
        if (!codes.has(ref))
          ctx.addIssue({ code: 'custom', message: `${where}: unknown question ${ref}` });
      }
      for (const ref of referencedAssignments(condition)) {
        if (!assignments.has(ref)) {
          ctx.addIssue({ code: 'custom', message: `${where}: unknown assignment ${ref}` });
        }
      }
    };

    for (const block of definition.blocks) {
      check(`Block ${block.code}`, block.displayLogic);
      for (const question of block.questions) {
        check(question.code, question.displayLogic);
        check(question.code, question.screenOut);
        const config = question.config as {
          pipeFrom?: { question: string };
          assignment?: string;
        };
        if (config.pipeFrom && !codes.has(config.pipeFrom.question)) {
          ctx.addIssue({
            code: 'custom',
            message: `${question.code}: pipes from unknown question ${config.pipeFrom.question}`,
          });
        }
        if (config.assignment && !assignments.has(config.assignment)) {
          ctx.addIssue({
            code: 'custom',
            message: `${question.code}: unknown assignment ${config.assignment}`,
          });
        }
      }
    }
    for (const quota of definition.quotas) check(`Quota ${quota.name}`, quota.conditions);
    for (const assignment of definition.assignments) {
      for (const ref of assignment.stratifyBy) {
        if (!codes.has(ref)) {
          ctx.addIssue({
            code: 'custom',
            message: `Assignment ${assignment.name}: unknown question ${ref}`,
          });
        }
      }
    }
  });

export type SurveyDefinition = z.output<typeof surveyDefinitionSchema>;
export type SurveyDefinitionInput = z.input<typeof surveyDefinitionSchema>;
