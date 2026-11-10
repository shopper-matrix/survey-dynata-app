import { answerSchema, type AnswerValue } from '@survey-dynata/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PresentedQuestion } from '../api';
import { en } from '../messages';
import { QuestionRenderer } from './QuestionRenderer';
import type { AnswerMeta } from './types';

// Every component must produce answers the API accepts: checked with the shared answer schema.

/** The nth element, failing the test clearly if it is missing. */
function at(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index];
  if (!element) throw new Error(`No element at index ${String(index)}`);
  return element;
}

const opts = (...ids: string[]) => ids.map((id) => ({ id, label: `Option ${id}` }));

function setup(type: string, config: Record<string, unknown>) {
  const question: PresentedQuestion = { code: 'Q', type, text: 'Question?', config };
  const result: { value?: AnswerValue | undefined; meta?: AnswerMeta | undefined } = {};
  function Harness() {
    const [value, setValue] = useState<AnswerValue>();
    return (
      <QuestionRenderer
        question={question}
        value={value}
        onChange={(next, meta) => {
          setValue(next);
          result.value = next;
          result.meta = meta;
        }}
        labelledBy="heading"
        describedBy={undefined}
        t={en}
      />
    );
  }
  render(<Harness />);
  const valid = () => answerSchema(type as never, config).safeParse(result.value).success;
  return { result, valid };
}

describe('question components produce valid answers', () => {
  it('single choice', async () => {
    const { result, valid } = setup('single_choice', { options: opts('a', 'b') });
    await userEvent.click(screen.getByText('Option b'));
    expect(result.value).toEqual({ optionId: 'b' });
    expect(valid()).toBe(true);
  });

  it('multiple choice keeps an exclusive option alone', async () => {
    const { result, valid } = setup('multi_choice', {
      options: [...opts('a', 'b'), { id: 'none', label: 'None', exclusive: true }],
    });
    await userEvent.click(screen.getByText('Option a'));
    await userEvent.click(screen.getByText('Option b'));
    expect(result.value).toEqual({ optionIds: ['a', 'b'] });
    await userEvent.click(screen.getByText('None'));
    expect(result.value).toEqual({ optionIds: ['none'] });
    expect(valid()).toBe(true);
  });

  it('grid single needs every row', async () => {
    const { result, valid } = setup('grid_single', {
      rows: opts('r1', 'r2'),
      columns: opts('1', '2'),
    });
    await userEvent.click(at(screen.getAllByRole('radio', { name: 'Option 2' }), 0));
    expect(valid()).toBe(false);
    await userEvent.click(at(screen.getAllByRole('radio', { name: 'Option 1' }), 1));
    expect(result.value).toEqual({ rows: { r1: '2', r2: '1' } });
    expect(valid()).toBe(true);
  });

  it('grid multi', async () => {
    const { valid } = setup('grid_multi', { rows: opts('r1'), columns: opts('1', '2') });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Option 2' }));
    expect(valid()).toBe(true);
  });

  it('open text and number', async () => {
    const text = setup('open_text', { minLength: 2, maxLength: 50 });
    await userEvent.type(screen.getByRole('textbox'), 'Gut');
    expect(text.valid()).toBe(true);
  });

  it('number', async () => {
    const { result, valid } = setup('number', { min: 0, max: 50 });
    await userEvent.type(screen.getByRole('spinbutton'), '12');
    expect(result.value).toEqual({ value: 12 });
    expect(valid()).toBe(true);
  });

  it('rating', async () => {
    const { valid } = setup('rating', { min: 0, max: 10, lowLabel: 'low', highLabel: 'high' });
    await userEvent.click(screen.getByText('7'));
    expect(valid()).toBe(true);
  });

  it('slider per item, with "can’t say"', async () => {
    const config = {
      min: 1,
      max: 7,
      lowLabel: 'treat',
      highLabel: 'health',
      items: opts('p1', 'p2'),
      allowNotApplicable: true,
    };
    const { result, valid } = setup('slider', config);
    fireEvent.change(at(screen.getAllByRole('slider'), 0), { target: { value: '6' } });
    expect(valid()).toBe(false);
    await userEvent.click(at(screen.getAllByRole('checkbox', { name: en.cannotJudge }), 1));
    expect(result.value).toEqual({ values: { p1: 6, p2: null } });
    expect(valid()).toBe(true);
  });

  it('semantic differential', async () => {
    const { valid } = setup('semantic_differential', {
      pairs: [{ id: 'x', left: 'dry', right: 'juicy' }],
      points: 7,
    });
    await userEvent.click(screen.getByText('5'));
    expect(valid()).toBe(true);
  });

  it('MaxDiff: best and worst per set, never the same item', async () => {
    const { result, valid } = setup('maxdiff', {
      items: opts('a', 'b', 'c'),
      itemsPerSet: 3,
      sets: [['a', 'b', 'c']],
    });
    await userEvent.click(screen.getByRole('radio', { name: `${en.best}: Option a` }));
    await userEvent.click(screen.getByRole('radio', { name: `${en.worst}: Option a` }));
    expect(result.value).toEqual({ sets: [{ worst: 'a' }] });
    await userEvent.click(screen.getByRole('radio', { name: `${en.best}: Option c` }));
    expect(valid()).toBe(true);
  });

  it('constant sum shows the points left', async () => {
    const { valid } = setup('constant_sum', { options: opts('a', 'b'), total: 10 });
    const spinbuttons = screen.getAllByRole('spinbutton');
    await userEvent.type(at(spinbuttons, 0), '7');
    expect(screen.getByText(en.pointsLeft(3))).toBeDefined();
    await userEvent.type(at(spinbuttons, 1), '3');
    expect(valid()).toBe(true);
  });

  it('mapping with axes uses sliders; without axes, groups', async () => {
    const stimuli = opts('s1', 's2');
    const placed = setup('mapping', {
      stimuli,
      xAxis: { left: 'muesli', right: 'sweets' },
      yAxis: { bottom: 'treat', top: 'health' },
      mobile: 'sliders',
    });
    for (const slider of screen.getAllByRole('slider'))
      fireEvent.change(slider, { target: { value: '0.8' } });
    expect(placed.valid()).toBe(true);
    document.body.innerHTML = '';

    const sorted = setup('mapping', { stimuli, mobile: 'sorting', groups: { min: 2, max: 3 } });
    await userEvent.click(at(screen.getAllByRole('radio', { name: en.group(1) }), 0));
    await userEvent.click(at(screen.getAllByRole('radio', { name: en.group(2) }), 1));
    expect(sorted.result.value).toEqual({ groups: [['s1'], ['s2']] });
    expect(sorted.valid()).toBe(true);
  });

  it('click map', async () => {
    const { valid } = setup('click_map', {
      imageUrl: '/demo/store-layout.svg',
      imageAlt: 'Store',
      zones: [{ id: 'z1', label: 'Sweets', x: 0, y: 0, width: 50, height: 50 }],
      targets: opts('t1'),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Option t1: Sweets' }));
    expect(valid()).toBe(true);
  });

  it('paired comparison', async () => {
    const { valid } = setup('paired_comparison', {
      items: opts('p1', 'p2'),
      pairs: [['p1', 'p2']],
      questions: [{ id: 'q', label: 'Which looks tastier?' }],
    });
    await userEvent.click(screen.getByRole('radio', { name: 'Option p2' }));
    expect(valid()).toBe(true);
  });

  it('timed exposure hides the picture after the exposure time and records the response time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result, valid } = setup('timed_exposure', {
        stimuli: [{ id: 'pack', label: 'Pack', imageUrl: '/demo/pack.svg' }],
        exposureMs: 3000,
        options: opts('bar', 'cereal'),
      });
      await userEvent.click(screen.getByRole('button', { name: en.continue }));
      expect(screen.getByRole('img', { name: 'Pack' })).toBeDefined();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.queryByRole('img', { name: 'Pack' })).toBeNull();
      await userEvent.click(screen.getByText('Option bar'));
      expect(result.value).toEqual({ stimulusId: 'pack', optionId: 'bar' });
      expect(typeof result.meta?.responseTimeMs).toBe('number');
      expect(valid()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('info screens are acknowledged by being shown', () => {
    const { result, valid } = setup('info', { body: 'Next, some products.' });
    expect(result.value).toEqual({ seen: true });
    expect(valid()).toBe(true);
  });
});
