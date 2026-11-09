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
import { fieldworkStats, quotaCells, recentRespondents, surveys } from '../fake-data';
import { CompletesChart } from './CompletesChart';
import { RespondentStatusBadge, SurveyStatusBadge } from './StatusBadge';

const survey = surveys[0];

const counters = [
  { label: 'Starts', value: String(fieldworkStats.starts) },
  { label: 'Completes', value: String(fieldworkStats.completes) },
  { label: 'Screen-outs', value: String(fieldworkStats.screenouts) },
  { label: 'Over-quotas', value: String(fieldworkStats.overquotas) },
  { label: 'Quality terms', value: String(fieldworkStats.qualityTerms) },
  { label: 'Incidence rate', value: `${String(Math.round(fieldworkStats.incidence * 100))}%` },
  { label: 'Median length', value: `${String(fieldworkStats.medianLoiMinutes)} min` },
];

export default function Dashboard() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{survey?.title ?? 'Survey'}</h1>
        {survey ? <SurveyStatusBadge status={survey.status} /> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Live fieldwork · refreshes every 30 s</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {counters.map((counter) => (
          <div key={counter.label} className="rounded-lg border p-4">
            <dt className="text-sm text-muted-foreground">{counter.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{counter.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Completes over time</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletesChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quotas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {quotaCells.map((cell) => (
              <div key={cell.name}>
                <div className="flex justify-between text-sm">
                  <span>{cell.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {cell.current} / {cell.target}
                  </span>
                </div>
                <Progress
                  value={(cell.current / cell.target) * 100}
                  aria-label={`${cell.name} quota`}
                  className="mt-2 h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent respondents</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dynata ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Length</TableHead>
                <TableHead>Quality flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRespondents.map((respondent) => (
                <TableRow key={respondent.id}>
                  <TableCell className="font-mono text-sm">{respondent.id}</TableCell>
                  <TableCell>
                    <RespondentStatusBadge status={respondent.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">{respondent.started}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {respondent.minutes === null ? '–' : `${String(respondent.minutes)} min`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {respondent.flags.length > 0 ? respondent.flags.join(', ') : '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
