import { describe, expect, it } from 'vitest';
import { nextStep, progressPercent } from './flow';

describe('respondent flow', () => {
  it('moves to the following screen', () => {
    expect(nextStep('welcome')).toBe('single');
    expect(nextStep('rating')).toBe('end/complete');
  });

  it('stays on the last screen', () => {
    expect(nextStep('end/complete')).toBe('end/complete');
  });

  it('reports progress from 0 to 100', () => {
    expect(progressPercent('welcome')).toBe(0);
    expect(progressPercent('end/complete')).toBe(100);
  });
});
