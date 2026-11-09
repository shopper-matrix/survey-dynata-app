import { describe, expect, it } from 'vitest';
import { completesPerDay, counters, medianOf } from './fieldwork.js';

describe('fieldwork counters', () => {
  it('counts outcomes, incidence rate and median interview length', () => {
    const result = counters(
      { started: 4, complete: 6, screenout: 2, overquota: 3, quality: 1, abandoned: 2 },
      [300, 600, 900],
    );
    expect(result).toEqual({
      starts: 18,
      completes: 6,
      screenouts: 2,
      overquotas: 3,
      qualityTerms: 1,
      incidenceRate: 0.75,
      medianLoiMinutes: 10,
    });
  });

  it('has no incidence rate or length before anyone qualified', () => {
    expect(counters({ started: 2 }, [])).toMatchObject({
      starts: 2,
      incidenceRate: null,
      medianLoiMinutes: null,
    });
  });

  it('takes the mean of the two middle values for an even count', () => {
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    expect(medianOf([])).toBeNull();
  });
});

describe('completes per day', () => {
  it('groups by UTC day and fills days without completes', () => {
    expect(
      completesPerDay([
        new Date('2026-11-03T23:30:00Z'),
        new Date('2026-11-01T08:00:00Z'),
        new Date('2026-11-03T01:00:00Z'),
      ]),
    ).toEqual([
      { day: '2026-11-01', completes: 1 },
      { day: '2026-11-02', completes: 0 },
      { day: '2026-11-03', completes: 2 },
    ]);
    expect(completesPerDay([])).toEqual([]);
  });
});
