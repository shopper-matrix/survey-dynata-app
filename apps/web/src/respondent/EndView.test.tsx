import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndView, FALLBACK_DELAY_MS, REDIRECT_DELAY_MS } from './EndView';
import { en } from './messages';

const replace = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('location', { replace });
  replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('EndView (DSA-405)', () => {
  it('thanks the respondent, then redirects in under a second', () => {
    render(<EndView outcome="complete" redirectUrl="https://panel.example/end?rst=1" t={en} />);
    expect(screen.getByRole('heading', { name: 'Thank you!' })).toBeDefined();
    expect(screen.getByText(en.redirecting)).toBeDefined();
    expect(REDIRECT_DELAY_MS).toBeLessThan(1000);
    act(() => {
      vi.advanceTimersByTime(REDIRECT_DELAY_MS);
    });
    expect(replace).toHaveBeenCalledWith('https://panel.example/end?rst=1');
  });

  it('shows a Continue link with the same URL if the redirect does not happen', () => {
    render(<EndView outcome="complete" redirectUrl="https://panel.example/end?rst=1" t={en} />);
    expect(screen.queryByRole('link', { name: en.continue })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(FALLBACK_DELAY_MS);
    });
    expect(screen.getByRole('link', { name: en.continue }).getAttribute('href')).toBe(
      'https://panel.example/end?rst=1',
    );
  });

  it('uses polite, neutral wording for a screen-out', () => {
    render(<EndView outcome="screenout" redirectUrl="/end?rst=2" t={en} />);
    expect(screen.getByRole('heading', { name: 'Thank you for your time' })).toBeDefined();
    expect(screen.getByText(en.end.screenout.message)).toBeDefined();
  });
});
