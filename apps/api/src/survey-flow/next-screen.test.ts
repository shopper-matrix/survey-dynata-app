import type { AnswerValue } from '@survey-dynata/shared';
import { describe, expect, it } from 'vitest';
import { orderedBlocks, rotateBlocks, walkSurvey } from './next-screen.js';
import {
  BLOCK_ORDER_KEY,
  type FlowBlock,
  type FlowQuestion,
  type FlowSurvey,
  type RespondentState,
} from './types.js';

const options = (...ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase() }));

function question(code: string, overrides: Partial<FlowQuestion> = {}): FlowQuestion {
  return {
    id: code,
    code,
    type: 'single_choice',
    text: `${code}?`,
    config: { options: options('1', '2') },
    isScreener: false,
    displayLogic: null,
    screenOutRules: [],
    translations: {},
    ...overrides,
  };
}

function block(
  code: string,
  questions: FlowQuestion[],
  overrides: Partial<FlowBlock> = {},
): FlowBlock {
  return { code, rotationGroup: null, displayLogic: null, questions, ...overrides };
}

const survey: FlowSurvey = {
  id: 's',
  language: 'en',
  assignments: [{ name: 'cell', values: ['A', 'B'], pick: 1, stratifyBy: [] }],
  blocks: [
    block('A', [
      question('Q1', {
        type: 'multi_choice',
        config: {
          options: [...options('x', 'y', 'z'), { id: 'none', label: 'None', exclusive: true }],
          randomize: true,
        },
      }),
      // Piped: only the options picked in Q1.
      question('Q2', {
        config: { options: options('x', 'y', 'z'), pipeFrom: { question: 'Q1' } },
      }),
      question('Q3', { displayLogic: { question: 'Q1', op: 'includes_any', value: ['z'] } }),
    ]),
    block('B', [
      question('Q4', { displayLogic: { assignment: 'cell', op: 'equals', value: 'A' } }),
      question('Q5'),
    ]),
  ],
};

function state(
  answers: Record<string, AnswerValue> = {},
  assignments: Record<string, unknown> = {},
): RespondentState {
  return {
    respondentId: 'r1',
    language: null,
    answers: new Map(Object.entries(answers)),
    assignments: { [BLOCK_ORDER_KEY]: ['A', 'B'], ...assignments },
  };
}

const step = (s: RespondentState) => walkSurvey(survey, s).step;
const code = (s: RespondentState) => {
  const result = step(s);
  return result.kind === 'screen' ? result.question.code : result.kind;
};

describe('walkSurvey', () => {
  it('starts with the first question and reports progress', () => {
    const first = step(state());
    expect(first).toMatchObject({ kind: 'screen', progress: 0, question: { code: 'Q1' } });
  });

  it('pipes only the chosen options and skips a question whose piped list is empty', () => {
    const piped = step(state({ Q1: { optionIds: ['y', 'z'] } }));
    expect(piped.kind === 'screen' && piped.question.config.options).toEqual(options('y', 'z'));
    expect(code(state({ Q1: { optionIds: ['none'] } }))).toBe('needs_assignment');
  });

  it('applies display logic on earlier answers', () => {
    expect(code(state({ Q1: { optionIds: ['z'] }, Q2: { optionId: 'z' } }))).toBe('Q3');
    expect(code(state({ Q1: { optionIds: ['x'] }, Q2: { optionId: 'x' } }))).toBe(
      'needs_assignment',
    );
  });

  it('asks for a test group only when the next question depends on it', () => {
    const answered = { Q1: { optionIds: ['x'] }, Q2: { optionId: 'x' } };
    expect(step(state(answered))).toEqual({ kind: 'needs_assignment', name: 'cell' });
    expect(code(state(answered, { cell: 'A' }))).toBe('Q4');
    expect(code(state(answered, { cell: 'B' }))).toBe('Q5');
  });

  it('is done when nothing is left, and lists answered visible questions', () => {
    const walk = walkSurvey(
      survey,
      state(
        { Q1: { optionIds: ['x'] }, Q2: { optionId: 'x' }, Q5: { optionId: '1' } },
        { cell: 'B' },
      ),
    );
    expect(walk.step).toEqual({ kind: 'done' });
    expect([...walk.answeredVisible]).toEqual(['Q1', 'Q2', 'Q5']);
  });

  it('randomises options the same way on every reload, exclusive options last', () => {
    const order = () => {
      const result = step(state());
      return result.kind === 'screen'
        ? (result.question.config.options as { id: string }[]).map((o) => o.id)
        : [];
    };
    expect(order()).toEqual(order());
    expect(order().at(-1)).toBe('none');
    expect(order().slice(0, 3).sort()).toEqual(['x', 'y', 'z']);
  });

  it('never sends internal fields such as pipeFrom or randomize', () => {
    const result = step(state({ Q1: { optionIds: ['x'] } }));
    expect(result.kind === 'screen' && Object.keys(result.question.config)).toEqual(['options']);
  });
});

describe('block order', () => {
  const blocks = [
    block('A', []),
    block('D', [], { rotationGroup: 'DE' }),
    block('E', [], { rotationGroup: 'DE' }),
    block('F', []),
  ];

  it('shuffles only blocks of a rotation group, within their positions', () => {
    expect(rotateBlocks(blocks, (items) => [...items].reverse())).toEqual(['A', 'E', 'D', 'F']);
  });

  it('follows the stored order and keeps unknown blocks in place', () => {
    const s = state({}, { [BLOCK_ORDER_KEY]: ['A', 'E', 'D'] });
    const ordered = orderedBlocks({ id: 's', language: 'en', assignments: [], blocks }, s);
    expect(ordered.map((b) => b.code)).toEqual(['A', 'E', 'D', 'F']);
  });
});
