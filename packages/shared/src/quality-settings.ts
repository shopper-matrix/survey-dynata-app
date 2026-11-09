import { z } from 'zod';

// Per-survey settings of the quality checks that run when a respondent finishes (DSA-501).
// Each check is off, only flags the respondent, or ends them with the quality outcome.

export const qualityActionSchema = z.enum(['off', 'flag', 'terminate']);
export type QualityAction = z.infer<typeof qualityActionSchema>;

export const qualitySettingsSchema = z.strictObject({
  speeder: z
    .strictObject({
      action: qualityActionSchema.default('flag'),
      /** Speeder = interview shorter than this share of the median length. */
      shareOfMedian: z
        .number()
        .gt(0)
        .lt(1)
        .default(1 / 3),
      /** Below this many completes the median is unreliable; the estimated length is used. */
      minCompletesForMedian: z.int().min(1).default(20),
    })
    .prefault({}),
  straightlining: z
    .strictObject({
      action: qualityActionSchema.default('flag'),
      /** Only grids with at least this many rows shown are checked. */
      minRows: z.int().min(2).default(4),
    })
    .prefault({}),
  attentionCheck: z
    .strictObject({
      action: qualityActionSchema.default('terminate'),
      /** Failed attention checks tolerated before the action applies. */
      allowedFailures: z.int().min(0).default(0),
    })
    .prefault({}),
});

export type QualitySettings = z.infer<typeof qualitySettingsSchema>;
export type QualitySettingsInput = z.input<typeof qualitySettingsSchema>;

/** Expected answer of an attention check: the option(s) to pick, in one grid row if set. */
export const attentionAnswerSchema = z.strictObject({
  row: z.string().min(1).optional(),
  expected: z.array(z.string().min(1)).min(1),
});

export type AttentionAnswer = z.infer<typeof attentionAnswerSchema>;
