import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { nextStep, progressPercent, type FlowStep } from './flow';
import { ErrorMessage } from '@/components/survey/ErrorMessage';
import { SurveyLayout } from '@/components/survey/SurveyLayout';

interface QuestionScreenProps {
  step: FlowStep;
  question: string;
  hint?: string;
  /** Message shown when Next is pressed without a valid answer; null = answer is valid. */
  validationError: string | null;
  /** Overrides where Next goes (e.g. a screener answer that screens out). */
  nextPath?: string;
  children: (ids: { questionId: string; errorId: string; showError: boolean }) => ReactNode;
}

/** One question per screen: text, answer area, inline validation and a Next button. */
export function QuestionScreen({
  step,
  question,
  hint,
  validationError,
  nextPath,
  children,
}: QuestionScreenProps) {
  const navigate = useNavigate();
  const questionId = useId();
  const errorId = useId();
  const [submitted, setSubmitted] = useState(false);
  const showError = submitted && validationError !== null;

  function handleNext() {
    setSubmitted(true);
    if (validationError === null) {
      void navigate(nextPath ?? `/survey/${nextStep(step)}`);
    }
  }

  return (
    <SurveyLayout
      progress={progressPercent(step)}
      footer={
        <Button size="lg" className="h-12 w-full text-base sm:w-auto sm:px-10" onClick={handleNext}>
          Next
        </Button>
      }
    >
      <h1 id={questionId} className="mt-4 text-lg leading-snug font-semibold sm:text-xl">
        {question}
      </h1>
      {hint ? <p className="mt-1 text-muted-foreground">{hint}</p> : null}
      <div className="mt-6">{children({ questionId, errorId, showError })}</div>
      {showError ? <ErrorMessage id={errorId}>{validationError}</ErrorMessage> : null}
    </SurveyLayout>
  );
}
