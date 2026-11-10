import { surveyDefinitionSchema } from '@survey-dynata/shared';
import { describe, expect, it } from 'vitest';
import { buildDemoRespondents } from '../seed/demo-respondents.js';
import { demoDefinition } from '../seed/demo-survey.js';
import { buildColumns, type ExportRow } from './columns.js';
import { writeCsv } from './csv.js';

// The demo survey has every question type, so it exercises every column builder.
const definition = surveyDefinitionSchema.parse(demoDefinition);
const questions = definition.blocks.flatMap((block) => block.questions);
const rows: ExportRow[] = buildDemoRespondents().map((r, index) => ({
  id: `r${String(index)}`,
  panelRespondentId: r.panelRespondentId,
  status: r.status,
  isTest: false,
  deviceType: r.deviceType,
  startedAt: r.startedAt,
  endedAt: r.endedAt,
  qualityFlags: r.qualityFlags,
  assignments: r.assignments,
  answers: new Map(
    r.answers.map((a) => [a.questionCode, { value: a.value, responseTimeMs: a.responseTimeMs }]),
  ),
}));
const columns = buildColumns(questions, ['pack']);

describe('export columns', () => {
  it('creates unique, SPSS-safe variable names for every question type', () => {
    const names = columns.map((c) => c.name);
    expect(new Set(names.map((n) => n.toUpperCase())).size).toBe(names.length);
    expect(names.every((n) => /^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(n))).toBe(true);
    for (const question of questions.filter((q) => q.type !== 'info')) {
      expect(
        names.some((n) => n.startsWith(question.code)),
        question.code,
      ).toBe(true);
    }
  });

  it('only produces codes that have a value label (or lie on a labelled scale)', () => {
    for (const column of columns.filter((c) => c.valueLabels)) {
      const labels = column.valueLabels ?? [];
      const codes = labels.map(([code]) => code);
      // Bipolar scales (semantic differential) label only their two ends.
      const scale = labels.length === 2 && codes[0] === 1 ? { min: 1, max: codes[1] ?? 1 } : null;
      for (const row of rows) {
        const value = column.value(row);
        if (value === null) continue;
        const ok = scale
          ? (value as number) >= scale.min && (value as number) <= scale.max
          : codes.includes(value as number);
        expect(ok, `${column.name}=${String(value)}`).toBe(true);
      }
    }
  });

  it('writes a CSV with a header and one line per respondent, codes or labels', () => {
    const coded = writeCsv(columns, rows, false).split('\r\n');
    expect(coded[0]?.replace(String.fromCharCode(0xfeff), '').split(',')[0]).toBe('RESPONDENT_ID');
    expect(coded).toHaveLength(rows.length + 2); // header + rows + trailing newline
    const labelled = writeCsv(columns, rows, true);
    expect(labelled).toMatch(/,complete,/);
  });

  it('defuses spreadsheet formulas and quotes separators in text answers', () => {
    const [row] = rows;
    if (!row) throw new Error('no demo rows');
    const evil: ExportRow = {
      ...row,
      answers: new Map([['D2', { value: { text: '=HYPERLINK("x")' }, responseTimeMs: null }]]),
    };
    const csv = writeCsv(columns, [evil], false);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
