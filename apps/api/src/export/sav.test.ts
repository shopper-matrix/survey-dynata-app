import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { buildColumns, type ExportQuestion, type ExportRow } from './columns.js';
import { writeSav } from './sav.js';

// sav-reader is an independent .sav implementation, used here only to verify our writer.
// It only ships a CommonJS entry, so it is loaded with require.
interface SavMeta {
  header: { n_cases: number; n_vars: number; encoding: string };
  /** type: 0 = numeric, otherwise the string width. */
  sysvars: { name: string; type: number; label?: string }[];
  getValueLabels(name: string): { val: number; label: string }[] | null;
}
interface SavReader {
  open(): Promise<void>;
  meta: SavMeta;
  readAllRows(): Promise<Record<string, unknown>[]>;
}
const { SavBufferReader } = createRequire(import.meta.url)('sav-reader') as {
  SavBufferReader: new (buffer: Buffer) => SavReader;
};

const SYSTEM_MISSING = -Number.MAX_VALUE;

const questions: ExportQuestion[] = [
  {
    code: 'A1',
    type: 'single_choice',
    text: 'Geschlecht',
    config: {
      options: [
        { id: 'w', label: 'weiblich' },
        { id: 'm', label: 'männlich' },
      ],
    },
  },
  { code: 'A2', type: 'number', text: 'Wie alt sind Sie?', config: { min: 0, max: 120 } },
  { code: 'D4', type: 'open_text', text: 'Weitere Situationen?', config: { maxLength: 500 } },
];

const row = (overrides: Partial<ExportRow>): ExportRow => ({
  id: '019a0000-0000-7000-8000-000000000001',
  panelRespondentId: 'P-1',
  status: 'complete',
  isTest: false,
  deviceType: 'phone',
  startedAt: new Date('2026-11-09T10:00:00Z'),
  endedAt: new Date('2026-11-09T10:12:30Z'),
  qualityFlags: [],
  assignments: { H3: 'B' },
  answers: new Map(),
  ...overrides,
});

const rows: ExportRow[] = [
  row({
    answers: new Map([
      ['A1', { value: { optionId: 'm' }, responseTimeMs: null }],
      ['A2', { value: { value: 34 }, responseTimeMs: null }],
      ['D4', { value: { text: 'Beim Wandern – Grüße' }, responseTimeMs: null }],
    ]),
  }),
  row({
    id: '019a0000-0000-7000-8000-000000000002',
    panelRespondentId: 'P-2',
    status: 'screenout',
    endedAt: null,
  }),
];

async function read(buffer: Buffer) {
  const sav = new SavBufferReader(buffer);
  await sav.open();
  return { meta: sav.meta, data: await sav.readAllRows() };
}

describe('writeSav', () => {
  const columns = buildColumns(questions, ['H3']);

  it('writes a file that an independent .sav reader can open', async () => {
    const { meta, data } = await read(writeSav(columns, rows, 'Rawbite test'));
    expect(meta.header.n_cases).toBe(2);
    expect(meta.header.n_vars).toBe(columns.length);
    expect(meta.header.encoding).toBe('UTF-8');
    expect(data).toHaveLength(2);
  });

  it('keeps long variable names, variable labels and value labels', async () => {
    const { meta } = await read(writeSav(columns, rows, 'Rawbite test'));
    const names = meta.sysvars.map((v) => v.name);
    expect(names).toEqual(
      expect.arrayContaining(['RESPONDENT_ID', 'STATUS', 'CELL_H3', 'A1', 'A2', 'D4']),
    );
    const a1 = meta.sysvars.find((v) => v.name === 'A1');
    expect(a1).toMatchObject({ type: 0, label: 'Geschlecht' });
    expect(meta.getValueLabels('A1')).toEqual([
      { val: 1, label: 'weiblich' },
      { val: 2, label: 'männlich' },
    ]);
  });

  it('stores codes, numbers, UTF-8 strings, date-times and missing values', async () => {
    const { data } = await read(writeSav(columns, rows, 'Rawbite test'));
    const [first, second] = data;
    expect(first).toMatchObject({ PANEL_ID: 'P-1', STATUS: 2, A1: 2, A2: 34, CELL_H3: 'B' });
    expect(String(first?.D4).trim()).toBe('Beim Wandern – Grüße');
    expect(first?.DURATION_MIN).toBe(12.5);
    // SPSS date-time: seconds since 14 Oct 1582.
    expect(first?.STARTED_AT).toBe(Date.UTC(2026, 10, 9, 10) / 1000 + 12_219_379_200);
    // Missing values are SPSS system-missing (-DBL_MAX); this reader returns the raw value.
    expect(second?.A1).toBe(SYSTEM_MISSING);
    expect(second?.ENDED_AT).toBe(SYSTEM_MISSING);
  });
});
