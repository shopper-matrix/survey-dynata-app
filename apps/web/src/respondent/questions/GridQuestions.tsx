import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { field, without, type Item, type QuestionProps } from './types';

// Grids: below 640 px every row is a stacked card with full-width options; from 640 px a
// matrix with one column per answer. The same inputs serve both layouts.

const MATRIX = 'sm:grid sm:items-center sm:gap-2';
const cellClass =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 sm:justify-center sm:border-0 sm:px-0 sm:has-[[data-state=checked]]:bg-transparent';

function columnsTemplate(count: number) {
  return { gridTemplateColumns: `minmax(8rem, 2fr) repeat(${String(count)}, minmax(0, 1fr))` };
}

function Header({ columns }: { columns: Item[] }) {
  return (
    <div
      aria-hidden
      className={`hidden pb-2 text-center text-sm text-muted-foreground ${MATRIX}`}
      style={columnsTemplate(columns.length)}
    >
      <span />
      {columns.map((column) => (
        <span key={column.id}>{column.label}</span>
      ))}
    </div>
  );
}

const rowClass = `rounded-lg border bg-card p-4 sm:rounded-none sm:border-0 sm:border-t sm:bg-transparent sm:px-0 sm:py-3 ${MATRIX}`;

export function GridSingle({ question, value, onChange, describedBy }: QuestionProps) {
  const rows = field<Item[]>(question, 'rows');
  const columns = field<Item[]>(question, 'columns');
  const answers = (value?.rows ?? {}) as Record<string, string>;

  return (
    <div className="grid gap-4 sm:gap-0">
      <Header columns={columns} />
      {rows.map((row) => {
        const labelId = `${question.code}-${row.id}-label`;
        return (
          <div key={row.id} className={rowClass} style={columnsTemplate(columns.length)}>
            <p id={labelId} className="mb-3 font-medium sm:mb-0 sm:pr-2">
              {row.label}
            </p>
            <RadioGroup
              value={answers[row.id] ?? ''}
              onValueChange={(columnId) => {
                onChange({ rows: { ...answers, [row.id]: columnId } });
              }}
              aria-labelledby={labelId}
              aria-describedby={describedBy && !answers[row.id] ? describedBy : undefined}
              className="gap-2 sm:contents"
            >
              {columns.map((column) => {
                const id = `${question.code}-${row.id}-${column.id}`;
                return (
                  <label key={column.id} htmlFor={id} className={cellClass}>
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
  );
}

export function GridMulti({ question, value, onChange, describedBy }: QuestionProps) {
  const rows = field<Item[]>(question, 'rows');
  const columns = field<Item[]>(question, 'columns');
  const answers = (value?.rows ?? {}) as Record<string, string[]>;
  const exclusive = new Set(columns.filter((c) => c.exclusive).map((c) => c.id));

  function toggle(rowId: string, columnId: string, checked: boolean) {
    const current = answers[rowId] ?? [];
    let next = checked ? [...current, columnId] : current.filter((id) => id !== columnId);
    if (checked)
      next = exclusive.has(columnId) ? [columnId] : next.filter((id) => !exclusive.has(id));
    onChange({ rows: next.length === 0 ? without(answers, rowId) : { ...answers, [rowId]: next } });
  }

  return (
    <div className="grid gap-4 sm:gap-0">
      <Header columns={columns} />
      {rows.map((row) => {
        const labelId = `${question.code}-${row.id}-label`;
        return (
          <div
            key={row.id}
            role="group"
            aria-labelledby={labelId}
            aria-describedby={describedBy && !answers[row.id] ? describedBy : undefined}
            className={rowClass}
            style={columnsTemplate(columns.length)}
          >
            <p id={labelId} className="mb-3 font-medium sm:mb-0 sm:pr-2">
              {row.label}
            </p>
            <div className="grid gap-2 sm:contents">
              {columns.map((column) => {
                const id = `${question.code}-${row.id}-${column.id}`;
                return (
                  <label key={column.id} htmlFor={id} className={cellClass}>
                    <Checkbox
                      id={id}
                      aria-label={column.label}
                      checked={(answers[row.id] ?? []).includes(column.id)}
                      onCheckedChange={(checked) => {
                        toggle(row.id, column.id, checked === true);
                      }}
                    />
                    <span aria-hidden className="sm:hidden">
                      {column.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
