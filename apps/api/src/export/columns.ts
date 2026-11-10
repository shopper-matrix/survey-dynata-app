import { chosenIds, type AnswerValue } from '@survey-dynata/shared';
import type { DeviceType, QuestionType, RespondentStatus } from '@survey-dynata/shared/db';

// Export columns (DSA-607): one row per respondent, one or more variables per question. Shared
// by the CSV and SPSS writers so both files have identical variables, labels and codes.

export interface ExportAnswer {
  value: AnswerValue;
  responseTimeMs: number | null;
}

export interface ExportRow {
  id: string;
  panelRespondentId: string;
  status: RespondentStatus;
  isTest: boolean;
  deviceType: DeviceType | null;
  startedAt: Date;
  endedAt: Date | null;
  qualityFlags: string[];
  assignments: Record<string, unknown>;
  answers: Map<string, ExportAnswer>;
}

export interface ExportQuestion {
  code: string;
  type: QuestionType;
  text: string;
  config: Record<string, unknown>;
}

export type CellValue = number | string | null;

export interface Column {
  name: string;
  label: string;
  kind: 'numeric' | 'string';
  /** Strings: width in bytes (max 255). */
  width?: number;
  /** Numerics: how SPSS shows the value. */
  format?: 'integer' | 'decimal' | 'datetime';
  valueLabels?: [number, string][];
  value(row: ExportRow): CellValue;
}

interface Item {
  id: string;
  label?: string;
}

const STATUS: RespondentStatus[] = [
  'started',
  'complete',
  'screenout',
  'overquota',
  'quality',
  'abandoned',
];
const DEVICES: DeviceType[] = ['phone', 'tablet', 'desktop'];
const SELECTED: [number, string][] = [
  [0, 'not selected'],
  [1, 'selected'],
];
const STRING_WIDTH = 255;

const labelsOf = (items: Item[]): [number, string][] =>
  items.map((item, index) => [index + 1, item.label ?? item.id]);
const codeOf = (items: Item[], id: unknown): number | null => {
  const index = items.findIndex((item) => item.id === id);
  return index === -1 ? null : index + 1;
};
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const minutes = (from: Date, to: Date | null) =>
  to ? Math.round(((to.getTime() - from.getTime()) / 60_000) * 100) / 100 : null;

/** Builds the export columns for a survey's questions (in survey order). */
export function buildColumns(questions: ExportQuestion[], assignmentNames: string[]): Column[] {
  const columns: Column[] = [
    {
      name: 'RESPONDENT_ID',
      label: 'Respondent ID (internal)',
      kind: 'string',
      width: 36,
      value: (r) => r.id,
    },
    {
      name: 'PANEL_ID',
      label: 'Panel respondent ID',
      kind: 'string',
      width: 64,
      value: (r) => r.panelRespondentId,
    },
    {
      name: 'STATUS',
      label: 'Status',
      kind: 'numeric',
      format: 'integer',
      valueLabels: STATUS.map((status, i) => [i + 1, status]),
      value: (r) => STATUS.indexOf(r.status) + 1,
    },
    {
      name: 'IS_TEST',
      label: 'Test respondent',
      kind: 'numeric',
      format: 'integer',
      valueLabels: [
        [0, 'no'],
        [1, 'yes'],
      ],
      value: (r) => (r.isTest ? 1 : 0),
    },
    {
      name: 'DEVICE',
      label: 'Device type',
      kind: 'numeric',
      format: 'integer',
      valueLabels: DEVICES.map((device, i) => [i + 1, device]),
      value: (r) => (r.deviceType ? DEVICES.indexOf(r.deviceType) + 1 : null),
    },
    {
      name: 'STARTED_AT',
      label: 'Started at',
      kind: 'numeric',
      format: 'datetime',
      value: (r) => r.startedAt.getTime(),
    },
    {
      name: 'ENDED_AT',
      label: 'Ended at',
      kind: 'numeric',
      format: 'datetime',
      value: (r) => r.endedAt?.getTime() ?? null,
    },
    {
      name: 'DURATION_MIN',
      label: 'Interview length (minutes)',
      kind: 'numeric',
      format: 'decimal',
      value: (r) => minutes(r.startedAt, r.endedAt),
    },
    {
      name: 'QUALITY_FLAGS',
      label: 'Quality flags',
      kind: 'string',
      width: STRING_WIDTH,
      value: (r) => r.qualityFlags.join(', '),
    },
    ...assignmentNames.map((name): Column => ({
      name: `CELL_${name}`,
      label: `Test group ${name}`,
      kind: 'string',
      width: 64,
      value: (r) => {
        const value = r.assignments[name];
        return Array.isArray(value) ? value.join(',') : typeof value === 'string' ? value : null;
      },
    })),
  ];
  for (const question of questions) columns.push(...questionColumns(question));
  return uniqueNames(columns);
}

function questionColumns(q: ExportQuestion): Column[] {
  const c = q.config as Record<string, unknown> & {
    options?: Item[];
    rows?: Item[];
    columns?: Item[];
    items?: Item[];
    pairs?: (Item & { left?: string; right?: string })[] | [string, string][];
    stimuli?: Item[];
    zones?: Item[];
    targets?: Item[];
    questions?: Item[];
    sets?: string[][];
    points?: number;
  };
  const answer = (row: ExportRow) => row.answers.get(q.code)?.value;
  const numeric = (
    suffix: string,
    label: string,
    get: (a: AnswerValue) => CellValue,
    valueLabels?: [number, string][],
    format: Column['format'] = 'integer',
  ): Column => ({
    name: `${q.code}${suffix}`,
    label,
    kind: 'numeric',
    format,
    ...(valueLabels ? { valueLabels } : {}),
    value: (row) => {
      const value = answer(row);
      return value ? get(value) : null;
    },
  });
  const options = c.options ?? [];

  switch (q.type) {
    case 'info':
      return [];
    case 'single_choice':
      return [numeric('', q.text, (a) => codeOf(options, a.optionId), labelsOf(options))];
    case 'multi_choice':
      return options.map((o) =>
        numeric(
          `_${o.id}`,
          `${q.text}: ${o.label ?? o.id}`,
          (a) => (chosenIds(a).includes(o.id) ? 1 : 0),
          SELECTED,
        ),
      );
    case 'grid_single': {
      const columns = c.columns ?? [];
      return (c.rows ?? []).map((row) =>
        numeric(
          `_${row.id}`,
          `${q.text}: ${row.label ?? row.id}`,
          (a) => codeOf(columns, (a.rows as Record<string, unknown> | undefined)?.[row.id]),
          labelsOf(columns),
        ),
      );
    }
    case 'grid_multi':
      return (c.rows ?? []).flatMap((row) =>
        (c.columns ?? []).map((column) =>
          numeric(
            `_${row.id}_${column.id}`,
            `${q.text}: ${row.label ?? row.id} – ${column.label ?? column.id}`,
            (a) => {
              const picked = (a.rows as Record<string, string[]> | undefined)?.[row.id];
              return picked ? (picked.includes(column.id) ? 1 : 0) : null;
            },
            SELECTED,
          ),
        ),
      );
    case 'open_text':
      return [
        {
          name: q.code,
          label: q.text,
          kind: 'string',
          width: STRING_WIDTH,
          value: (row) => {
            const text = answer(row)?.text;
            return typeof text === 'string' ? text : null;
          },
        },
      ];
    case 'number':
    case 'rating':
      return [numeric('', q.text, (a) => num(a.value), undefined, 'decimal')];
    case 'slider':
      if (!c.items) return [numeric('', q.text, (a) => num(a.value), undefined, 'decimal')];
      return c.items.map((item) =>
        numeric(
          `_${item.id}`,
          `${q.text}: ${item.label ?? item.id}`,
          (a) => num((a.values as Record<string, unknown> | undefined)?.[item.id]),
          undefined,
          'decimal',
        ),
      );
    case 'semantic_differential':
      return (c.pairs as (Item & { left: string; right: string })[]).map((pair) =>
        numeric(
          `_${pair.id}`,
          `${q.text}: ${pair.left} – ${pair.right}`,
          (a) => num((a.values as Record<string, unknown> | undefined)?.[pair.id]),
          [
            [1, pair.left],
            [c.points ?? 7, pair.right],
          ],
        ),
      );
    case 'maxdiff': {
      const items = c.items ?? [];
      return (c.sets ?? []).flatMap((_, index) => {
        const set = (a: AnswerValue) =>
          (a.sets as { best: string; worst: string }[] | undefined)?.[index];
        return [
          numeric(
            `_S${String(index + 1)}_BEST`,
            `${q.text}: set ${String(index + 1)} best`,
            (a) => codeOf(items, set(a)?.best),
            labelsOf(items),
          ),
          numeric(
            `_S${String(index + 1)}_WORST`,
            `${q.text}: set ${String(index + 1)} worst`,
            (a) => codeOf(items, set(a)?.worst),
            labelsOf(items),
          ),
        ];
      });
    }
    case 'constant_sum':
      return options.map((o) =>
        numeric(
          `_${o.id}`,
          `${q.text}: ${o.label ?? o.id}`,
          (a) => num((a.points as Record<string, unknown> | undefined)?.[o.id]) ?? 0,
        ),
      );
    case 'mapping':
      return (c.stimuli ?? []).flatMap((s) => {
        const position = (a: AnswerValue) =>
          (a.positions as Record<string, { x: number; y: number }> | undefined)?.[s.id];
        const group = (a: AnswerValue) => {
          const index =
            (a.groups as string[][] | undefined)?.findIndex((g) => g.includes(s.id)) ?? -1;
          return index === -1 ? null : index + 1;
        };
        return [
          numeric(
            `_${s.id}_X`,
            `${q.text}: ${s.label ?? s.id} (x)`,
            (a) => position(a)?.x ?? null,
            undefined,
            'decimal',
          ),
          numeric(
            `_${s.id}_Y`,
            `${q.text}: ${s.label ?? s.id} (y)`,
            (a) => position(a)?.y ?? null,
            undefined,
            'decimal',
          ),
          numeric(`_${s.id}_GROUP`, `${q.text}: ${s.label ?? s.id} (group)`, group),
        ];
      });
    case 'click_map': {
      const zones = c.zones ?? [];
      return (c.targets ?? []).map((t) =>
        numeric(
          `_${t.id}`,
          `${q.text}: ${t.label ?? t.id}`,
          (a) => codeOf(zones, (a.clicks as Record<string, unknown> | undefined)?.[t.id]),
          labelsOf(zones),
        ),
      );
    }
    case 'paired_comparison': {
      const items = c.items ?? [];
      const pairs = (c.pairs ?? []) as [string, string][];
      return pairs.flatMap((pair, index) =>
        (c.questions ?? []).map((pq) =>
          numeric(
            `_P${String(index + 1)}_${pq.id}`,
            `${q.text}: ${pair.join(' vs ')} – ${pq.label ?? pq.id}`,
            (a) => {
              const choice = (a.choices as { answers: Record<string, string> }[] | undefined)?.[
                index
              ];
              return codeOf(items, choice?.answers[pq.id]);
            },
            labelsOf(items),
          ),
        ),
      );
    }
    case 'timed_exposure': {
      const stimuli = c.stimuli ?? [];
      return [
        numeric(
          '_STIM',
          `${q.text}: stimulus shown`,
          (a) => codeOf(stimuli, a.stimulusId),
          labelsOf(stimuli),
        ),
        numeric('', q.text, (a) => codeOf(options, a.optionId), labelsOf(options)),
        {
          name: `${q.code}_MS`,
          label: `${q.text}: response time (ms)`,
          kind: 'numeric',
          format: 'integer',
          value: (row) => row.answers.get(q.code)?.responseTimeMs ?? null,
        },
      ];
    }
  }
}

/** SPSS-safe, unique variable names (letters, digits, _ . ; must start with a letter). */
function uniqueNames(columns: Column[]): Column[] {
  const seen = new Set<string>();
  return columns.map((column) => {
    let base = column.name.replace(/[^A-Za-z0-9_.]/g, '_').slice(0, 60);
    if (!/^[A-Za-z]/.test(base)) base = `Q${base}`;
    let name = base;
    for (let i = 2; seen.has(name.toUpperCase()); i++) name = `${base}_${String(i)}`;
    seen.add(name.toUpperCase());
    return { ...column, name };
  });
}
