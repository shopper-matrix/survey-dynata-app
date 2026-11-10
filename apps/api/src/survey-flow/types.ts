import type { AnswerValue, Condition, QuestionTranslations } from '@survey-dynata/shared';
import type { QuestionType } from '@survey-dynata/shared/db';

// The survey as the flow engine sees it: plain data, loaded once per request.

export interface FlowQuestion {
  id: string;
  code: string;
  type: QuestionType;
  text: string;
  config: Record<string, unknown>;
  isScreener: boolean;
  displayLogic: Condition | null;
  /** Screening rules: the respondent is screened out when one matches after answering. */
  screenOutRules: Condition[];
  translations: QuestionTranslations;
}

export interface FlowBlock {
  code: string;
  rotationGroup: string | null;
  displayLogic: Condition | null;
  questions: FlowQuestion[];
}

export interface FlowAssignment {
  name: string;
  values: string[];
  pick: number;
  stratifyBy: string[];
}

export interface FlowSurvey {
  id: string;
  /** Main language; translations add others. */
  language: string;
  blocks: FlowBlock[];
  assignments: FlowAssignment[];
}

/** Keys in Respondent.assignments that are not test groups. */
export const BLOCK_ORDER_KEY = '$blockOrder';
export const STRATA_KEY = '$strata';

export interface RespondentState {
  respondentId: string;
  /** Answer value by question code. */
  answers: Map<string, AnswerValue>;
  /** Respondent.assignments: test groups plus the block order and strata. */
  assignments: Record<string, unknown>;
  /** Language for question texts; null = the survey's main language. */
  language: string | null;
}

/** A question as shown to the respondent: piped, randomised, without internal fields. */
export interface PresentedQuestion {
  code: string;
  type: QuestionType;
  text: string;
  config: Record<string, unknown>;
}
