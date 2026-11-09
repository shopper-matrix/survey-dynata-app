import type { RespondentStatus } from '@survey-dynata/shared/db';

// Fieldwork figures for the live dashboard (DSA-605). Pure functions over respondent rows so the
// definitions (incidence rate, interview length) are tested without a database.

export type StatusCounts = Record<RespondentStatus, number>;

export interface FieldworkCounters {
  /** Every respondent who entered (all statuses). */
  starts: number;
  completes: number;
  screenouts: number;
  overquotas: number;
  qualityTerms: number;
  /** completes / (completes + screen-outs): over-quotas and drop-outs say nothing about it. */
  incidenceRate: number | null;
  /** Median minutes from entry to the end link, over completes. */
  medianLoiMinutes: number | null;
}

export function counters(counts: Partial<StatusCounts>, loiSeconds: number[]): FieldworkCounters {
  const count = (status: RespondentStatus) => counts[status] ?? 0;
  const qualified = count('complete') + count('screenout');
  const median = medianOf(loiSeconds);
  return {
    starts: Object.values(counts).reduce((sum, n) => sum + n, 0),
    completes: count('complete'),
    screenouts: count('screenout'),
    overquotas: count('overquota'),
    qualityTerms: count('quality'),
    incidenceRate: qualified === 0 ? null : count('complete') / qualified,
    medianLoiMinutes: median === null ? null : Math.round((median / 60) * 10) / 10,
  };
}

export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

/** Completes per UTC day, every day from the first to the last complete (gaps are zero). */
export function completesPerDay(endedAt: Date[]): { day: string; completes: number }[] {
  if (endedAt.length === 0) return [];
  const perDay = new Map<string, number>();
  for (const date of endedAt) {
    const day = date.toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const days = [...perDay.keys()].sort();
  const result: { day: string; completes: number }[] = [];
  const last = days.at(-1) ?? '';
  for (let day = days[0] ?? last; day <= last; day = nextDay(day)) {
    result.push({ day, completes: perDay.get(day) ?? 0 });
  }
  return result;
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
