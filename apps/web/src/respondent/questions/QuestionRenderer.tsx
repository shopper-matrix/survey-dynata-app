import type { ComponentType } from 'react';
import { MultiChoice, SingleChoice } from './ChoiceQuestions';
import { GridMulti, GridSingle } from './GridQuestions';
import {
  ClickMap,
  ConstantSum,
  Info,
  Mapping,
  MaxDiff,
  PairedComparison,
  TimedExposure,
} from './ResearchQuestions';
import { NumberInput, OpenText, Rating, SemanticDifferential, Slider } from './ScaleQuestions';
import type { QuestionProps } from './types';

const components: Record<string, ComponentType<QuestionProps>> = {
  info: Info,
  single_choice: SingleChoice,
  multi_choice: MultiChoice,
  grid_single: GridSingle,
  grid_multi: GridMulti,
  open_text: OpenText,
  number: NumberInput,
  rating: Rating,
  slider: Slider,
  semantic_differential: SemanticDifferential,
  maxdiff: MaxDiff,
  constant_sum: ConstantSum,
  mapping: Mapping,
  click_map: ClickMap,
  paired_comparison: PairedComparison,
  timed_exposure: TimedExposure,
};

/** Shows the component for the question's type. */
export function QuestionRenderer(props: QuestionProps) {
  const Component = components[props.question.type];
  if (!Component) throw new Error(`Unknown question type ${props.question.type}`);
  return <Component {...props} />;
}
