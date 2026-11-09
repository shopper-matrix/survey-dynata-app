import { evaluateCondition, type Condition, type ConditionContext } from '@survey-dynata/shared';

/**
 * Screening engine (DSA-307): a respondent fails screening as soon as any screen-out rule of an
 * answered screener matches. Rules use the shared condition format (equals, not equals, in
 * list, ranges, includes, AND / OR).
 */
export function failsScreening(rules: Condition[], ctx: ConditionContext): boolean {
  return rules.some((rule) => evaluateCondition(rule, ctx));
}
