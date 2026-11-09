import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { attitudesGrid } from '../../fake-data';
import { QuestionScreen } from '../QuestionScreen';

const MATRIX_COLUMNS = 'sm:grid-cols-[2fr_repeat(5,1fr)]';

/**
 * Agreement grid. Below 640 px each statement is a stacked card with full-width options;
 * from 640 px it becomes a matrix with one column per scale point.
 */
export function GridQuestion() {
  const [answers, setAnswers] = useState<Partial<Record<string, string>>>({});
  const unanswered = attitudesGrid.rows.filter((row) => !answers[row.id]).length;
  const { columns } = attitudesGrid;

  return (
    <QuestionScreen
      step="grid"
      question={attitudesGrid.text}
      validationError={
        unanswered === 0
          ? null
          : `Please answer every statement (${String(unanswered)} still open).`
      }
    >
      {({ errorId, showError }) => (
        <div className="grid gap-4 sm:gap-0">
          <div
            aria-hidden
            className={`hidden gap-2 pb-2 text-center text-sm text-muted-foreground sm:grid ${MATRIX_COLUMNS}`}
          >
            <span />
            {columns.map((column) => (
              <span key={column.id}>{column.label}</span>
            ))}
          </div>
          {attitudesGrid.rows.map((row) => {
            const missing = showError && !answers[row.id];
            const labelId = `grid-${row.id}-label`;
            return (
              <div
                key={row.id}
                className={`rounded-lg border bg-card p-4 sm:grid sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:border-t sm:bg-transparent sm:px-0 sm:py-3 ${MATRIX_COLUMNS}`}
              >
                <p id={labelId} className="mb-3 font-medium sm:mb-0 sm:pr-2">
                  {row.label}
                </p>
                <RadioGroup
                  value={answers[row.id] ?? ''}
                  onValueChange={(value) => {
                    setAnswers((current) => ({ ...current, [row.id]: value }));
                  }}
                  aria-labelledby={labelId}
                  aria-describedby={missing ? errorId : undefined}
                  aria-invalid={missing}
                  className="gap-2 sm:col-span-5 sm:grid-cols-5"
                >
                  {columns.map((column) => {
                    const id = `grid-${row.id}-${column.id}`;
                    return (
                      <label
                        key={column.id}
                        htmlFor={id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent sm:justify-center sm:border-0 sm:px-0 sm:has-[[data-state=checked]]:bg-transparent"
                      >
                        <RadioGroupItem id={id} value={column.id} aria-label={column.label} />
                        <span aria-hidden className="sm:hidden">
                          {column.label}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>
            );
          })}
        </div>
      )}
    </QuestionScreen>
  );
}
