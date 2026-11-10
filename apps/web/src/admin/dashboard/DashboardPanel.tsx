import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi, type FieldworkStats } from '../api';
import { RespondentStatusBadge } from '../StatusBadge';
import { CompletesChart } from './CompletesChart';
import { FieldworkActions } from './FieldworkActions';

/** Refresh interval of the live figures (story: at least every 30 seconds). */
export const REFRESH_MS = 30_000;

const percent = (value: number | null) =>
  value === null ? '–' : `${String(Math.round(value * 100))}%`;

function counterList(c: FieldworkStats['counters']) {
  return [
    { label: 'Starts', value: String(c.starts) },
    { label: 'Completes', value: String(c.completes) },
    { label: 'Screen-outs', value: String(c.screenouts) },
    { label: 'Over-quotas', value: String(c.overquotas) },
    { label: 'Quality terms', value: String(c.qualityTerms) },
    { label: 'Incidence rate', value: percent(c.incidenceRate) },
    {
      label: 'Median length',
      value: c.medianLoiMinutes === null ? '–' : `${String(c.medianLoiMinutes)} min`,
    },
  ];
}

/** Live fieldwork dashboard (DSA-605); polls the stats endpoint while it is shown. */
export function DashboardPanel({ surveyId, canEdit }: { surveyId: string; canEdit: boolean }) {
  const [stats, setStats] = useState<FieldworkStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      adminApi.stats(surveyId).then(
        (loaded) => {
          if (!active) return;
          setStats(loaded);
          setFailed(false);
        },
        () => {
          if (active) setFailed(true);
        },
      );
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [surveyId]);

  if (!stats) {
    return (
      <p className="text-muted-foreground">{failed ? 'Could not load the figures.' : 'Loading…'}</p>
    );
  }

  return (
    <section aria-label="Fieldwork" className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Live fieldwork without test respondents · refreshes every 30 s · last update{' '}
        {new Date(stats.updatedAt).toLocaleTimeString()}
        {failed ? ' · refresh failed, retrying' : ''}
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {counterList(stats.counters).map((counter) => (
          <div key={counter.label} className="rounded-lg border p-4">
            <dt className="text-sm text-muted-foreground">{counter.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{counter.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Completes over time</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletesChart data={stats.completesPerDay} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quotas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {stats.quotas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quota cells.</p>
            ) : (
              stats.quotas.map((cell) => (
                <div key={cell.name}>
                  <div className="flex justify-between text-sm">
                    <span>{cell.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {cell.currentCount} / {cell.target}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (cell.currentCount / cell.target) * 100)}
                    aria-label={`${cell.name} quota`}
                    className="mt-2 h-2"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent respondents</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Panel ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Quality flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent.map((r) => (
                <TableRow key={r.panelRespondentId}>
                  <TableCell className="font-mono text-xs">{r.panelRespondentId}</TableCell>
                  <TableCell>
                    <RespondentStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.startedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.deviceType ?? '–'}</TableCell>
                  <TableCell>{r.qualityFlags.join(', ') || '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canEdit ? <FieldworkActions surveyId={surveyId} /> : null}
    </section>
  );
}
