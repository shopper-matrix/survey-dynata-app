import { parseQuestionConfig, type AnswerValue } from '@survey-dynata/shared';
import type { Random } from '../lib/random.js';
import { attentionCheck, type DemoQuestion } from './demo-survey.js';

// Plausible answer values per question type, in the shared answer format
// (packages/shared/src/answers.ts); tests check every generated answer against it.

export interface AnswerContext {
  rng: Random;
  deviceType: 'phone' | 'tablet' | 'desktop';
  /** Same column picked for every grid row. */
  straightline: boolean;
  /** Wrong answer on the attention-check row. */
  failAttention: boolean;
  /** Pack shown in split-cell questions. */
  packVariant: string;
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

function pickOptions(
  rng: Random,
  options: { id: string; exclusive?: boolean | undefined }[],
): string[] {
  const regular = options.filter((option) => !option.exclusive);
  return rng.sample(ids(regular), rng.int(1, Math.min(3, regular.length)));
}

/** A plausible answer to a question. */
export function answerFor(question: DemoQuestion, ctx: AnswerContext): AnswerValue {
  const { rng } = ctx;

  switch (question.type) {
    case 'info':
      return { seen: true };

    case 'single_choice': {
      const { options } = parseQuestionConfig('single_choice', question.config);
      return { optionId: rng.pick(ids(options)) };
    }

    case 'multi_choice': {
      const { options } = parseQuestionConfig('multi_choice', question.config);
      return { optionIds: pickOptions(rng, options) };
    }

    case 'grid_single': {
      const { rows, columns } = parseQuestionConfig('grid_single', question.config);
      const fixed = rng.pick(ids(columns));
      const answers = Object.fromEntries(
        rows.map((row) => {
          if (question.code === attentionCheck.question && row.id === attentionCheck.row) {
            return [row.id, ctx.failAttention ? '1' : attentionCheck.expected];
          }
          return [row.id, ctx.straightline ? fixed : rng.pick(ids(columns))];
        }),
      );
      return { rows: answers };
    }

    case 'grid_multi': {
      const { rows, columns } = parseQuestionConfig('grid_multi', question.config);
      return {
        rows: Object.fromEntries(rows.map((row) => [row.id, pickOptions(rng, columns)])),
      };
    }

    case 'open_text':
      return {
        text: rng.pick([
          'Less sugar and more natural ingredients.',
          'Smaller packs for on the go.',
          'More flavours with nuts.',
          'A lower price.',
          '',
        ]),
      };

    case 'number': {
      const { min, max } = parseQuestionConfig('number', question.config);
      return { value: rng.int(min, Math.min(max, min + 10)) };
    }

    case 'rating': {
      const { min, max } = parseQuestionConfig('rating', question.config);
      return { value: rng.int(min, max) };
    }

    case 'slider': {
      const config = parseQuestionConfig('slider', question.config);
      const items = config.items ?? [];
      return {
        values: Object.fromEntries(
          items.map((item) => [
            item.id,
            config.allowNotApplicable && rng.chance(0.1) ? null : rng.int(config.min, config.max),
          ]),
        ),
      };
    }

    case 'semantic_differential': {
      const { pairs, points } = parseQuestionConfig('semantic_differential', question.config);
      return { values: Object.fromEntries(pairs.map((pair) => [pair.id, rng.int(1, points)])) };
    }

    case 'maxdiff': {
      const { sets } = parseQuestionConfig('maxdiff', question.config);
      return {
        sets: sets.map((set) => {
          const [best, worst] = rng.sample(set, 2);
          return { best, worst };
        }),
      };
    }

    case 'constant_sum': {
      const { options, total } = parseQuestionConfig('constant_sum', question.config);
      const points = new Map(ids(options).map((optionId) => [optionId, 0]));
      for (let i = 0; i < total; i++) {
        const optionId = rng.pick(ids(options));
        points.set(optionId, (points.get(optionId) ?? 0) + 1);
      }
      return { points: Object.fromEntries(points) };
    }

    case 'mapping': {
      const { stimuli } = parseQuestionConfig('mapping', question.config);
      // Coordinates from 0 to 1; phones answer via sliders, stored the same way.
      return {
        positions: Object.fromEntries(
          stimuli.map((stimulus) => [
            stimulus.id,
            { x: Math.round(rng.next() * 100) / 100, y: Math.round(rng.next() * 100) / 100 },
          ]),
        ),
        input: ctx.deviceType === 'phone' ? 'sliders' : 'drag',
      };
    }

    case 'click_map': {
      const { zones, targets } = parseQuestionConfig('click_map', question.config);
      return {
        clicks: Object.fromEntries(targets.map((target) => [target.id, rng.pick(ids(zones))])),
      };
    }

    case 'paired_comparison': {
      const { pairs, questions } = parseQuestionConfig('paired_comparison', question.config);
      return {
        choices: pairs.map((pair) => ({
          pair,
          answers: Object.fromEntries(questions.map((item) => [item.id, rng.pick(pair)])),
        })),
      };
    }

    case 'timed_exposure': {
      const { options } = parseQuestionConfig('timed_exposure', question.config);
      return { stimulusId: ctx.packVariant, optionId: rng.pick(ids(options)) };
    }
  }
}
