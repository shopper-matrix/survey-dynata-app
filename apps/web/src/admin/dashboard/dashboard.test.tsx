import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FieldworkStats } from '../api';
import { details, renderBuilder, stubAdminApi } from '../builder/test-helpers';
import { REFRESH_MS } from './DashboardPanel';

const stats = (completes: number): FieldworkStats => ({
  counters: {
    starts: 40,
    completes,
    screenouts: 10,
    overquotas: 3,
    qualityTerms: 2,
    incidenceRate: 0.75,
    medianLoiMinutes: 12.5,
  },
  completesPerDay: [{ day: '2026-11-08', completes }],
  quotas: [{ name: 'Frauen', kind: 'cap', target: 60, currentCount: 30 }],
  recent: [
    {
      panelRespondentId: 'P-9',
      status: 'quality',
      startedAt: '2026-11-08T10:00:00Z',
      endedAt: '2026-11-08T10:03:00Z',
      deviceType: 'mobile',
      qualityFlags: ['speeder'],
    },
  ],
  updatedAt: '2026-11-08T10:05:00Z',
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live dashboard (DSA-605)', () => {
  it('shows counters, quotas and recent respondents and refreshes every 30 seconds', async () => {
    // Only the polling interval is faked; user events and promises run normally.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let completes = 30;
    stubAdminApi({
      'GET /me': () => ({ body: { email: 'v@x.test', role: 'viewer' } }),
      'GET /surveys/s1': () => ({ body: details() }),
      'GET /surveys/s1/stats': () => ({ body: stats(completes) }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Dashboard' }));

    const counter = (label: string) =>
      within(screen.getByText(label).parentElement ?? document.body).getByRole('definition');
    expect((await screen.findByText('Incidence rate')).nextSibling?.textContent).toBe('75%');
    expect(counter('Completes').textContent).toBe('30');
    expect(counter('Median length').textContent).toBe('12.5 min');
    expect(screen.getByRole('progressbar', { name: 'Frauen quota' })).toBeDefined();
    expect(screen.getByText('Quality term')).toBeDefined();
    expect(screen.getByText('speeder')).toBeDefined();
    // Viewers see the figures but not the test-link and export actions.
    expect(screen.queryByRole('button', { name: 'Create 5 test links' })).toBeNull();

    completes = 31;
    vi.advanceTimersByTime(REFRESH_MS);
    await vi.waitFor(() => {
      expect(counter('Completes').textContent).toBe('31');
    });
  });

  it('lets editors create test links and download exports', async () => {
    stubAdminApi({
      'GET /me': () => ({ body: { email: 'e@x.test', role: 'editor' } }),
      'GET /surveys/s1': () => ({ body: details() }),
      'GET /surveys/s1/stats': () => ({ body: stats(1) }),
      'POST /surveys/s1/test-links': () => ({
        body: { links: ['http://localhost:5173/s/s1?psid=TEST-1'] },
      }),
    });
    renderBuilder();
    await userEvent.click(await screen.findByRole('tab', { name: 'Dashboard' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create 5 test links' }));
    const list = await screen.findByRole('list', { name: 'Test links' });
    expect(within(list).getByRole('link').getAttribute('href')).toContain('TEST-1');
    expect(screen.getByRole('link', { name: 'Export SPSS' }).getAttribute('href')).toBe(
      '/api/admin/surveys/s1/export?format=sav',
    );
  });
});
