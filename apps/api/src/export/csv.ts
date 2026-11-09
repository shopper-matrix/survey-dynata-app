import type { CellValue, Column, ExportRow } from './columns.js';

const BOM = String.fromCharCode(0xfeff);

/** One CSV cell: quoted when needed; formula-like text is defused for spreadsheet safety. */
function cell(value: CellValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function display(column: Column, value: CellValue, labels: boolean): CellValue {
  if (value === null || typeof value !== 'number') return value;
  if (column.format === 'datetime') return new Date(value).toISOString();
  if (labels) return column.valueLabels?.find(([code]) => code === value)?.[1] ?? value;
  return value;
}

/**
 * CSV with the same variables as the SPSS file. `labels` writes value labels instead of codes.
 * Starts with a UTF-8 BOM so Excel opens umlauts correctly.
 */
export function writeCsv(columns: Column[], rows: ExportRow[], labels: boolean): string {
  const header = columns.map((column) => cell(column.name)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => cell(display(column, column.value(row), labels))).join(','),
  );
  return `${BOM}${[header, ...lines].join('\r\n')}\r\n`;
}
