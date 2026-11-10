import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PresentedQuestion } from './api';
import { en } from './messages';
import { QuestionView } from './QuestionView';

const question = {
  code: 'Q1',
  type: 'single_choice',
  text: 'Erste Frage',
  config: {
    options: [
      { id: '1', label: 'Ja' },
      { id: '2', label: 'Nein' },
    ],
  },
} as PresentedQuestion;

function renderQuestion() {
  const onSubmit = vi.fn();
  const { container } = render(
    <QuestionView
      question={question}
      progress={0}
      busy={false}
      error={null}
      t={en}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, honeypot: container.querySelector<HTMLInputElement>('input[name="website"]') };
}

describe('honeypot field (DSA-502)', () => {
  it('is hidden from people and keyboard users and stays empty for them', async () => {
    const { onSubmit, honeypot } = renderQuestion();
    expect(honeypot?.tabIndex).toBe(-1);
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    // Not reachable by role either, so assistive technology never offers it.
    expect(screen.queryByRole('textbox', { name: 'Website' })).toBeNull();

    await userEvent.click(screen.getByText('Ja'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSubmit).toHaveBeenCalledWith({ optionId: '1' }, expect.anything(), '');
  });

  it('reports what a bot typed into it', async () => {
    const { onSubmit, honeypot } = renderQuestion();
    if (!honeypot) throw new Error('honeypot missing');
    await userEvent.type(honeypot, 'http://spam.example');
    await userEvent.click(screen.getByText('Ja'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSubmit).toHaveBeenCalledWith(
      { optionId: '1' },
      expect.anything(),
      'http://spam.example',
    );
  });
});
