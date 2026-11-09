import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ErrorMessage } from './ErrorMessage';
import { OptionCard } from './OptionCard';
import { PrimaryButton } from './PrimaryButton';
import { SurveyLayout } from './SurveyLayout';

describe('survey base components', () => {
  it('SurveyLayout shows a labelled progress bar and the action area', () => {
    render(
      <SurveyLayout progress={40} progressLabel="Fortschritt" footer={<button>Weiter</button>}>
        <h1>Frage</h1>
      </SurveyLayout>,
    );
    expect(screen.getByRole('progressbar', { name: 'Fortschritt' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDefined();
  });

  it('OptionCard selects its control when the whole card is tapped', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup>
        <OptionCard htmlFor="o1" label="Ja" control={<RadioGroupItem id="o1" value="1" />} />
      </RadioGroup>,
    );
    await user.click(screen.getByText('Ja'));
    expect(screen.getByRole('radio', { name: 'Ja' }).getAttribute('data-state')).toBe('checked');
  });

  it('ErrorMessage is announced to screen readers', () => {
    render(<ErrorMessage>Bitte wählen Sie eine Antwort.</ErrorMessage>);
    expect(screen.getByRole('alert').textContent).toBe('Bitte wählen Sie eine Antwort.');
  });

  it('PrimaryButton is disabled while busy', () => {
    render(<PrimaryButton busy>Weiter</PrimaryButton>);
    expect(screen.getByRole('button', { name: 'Weiter' }).hasAttribute('disabled')).toBe(true);
  });
});
