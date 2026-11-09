import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { surveys } from '../fake-data';
import { SurveyStatusBadge } from './StatusBadge';

const percent = (value: number) => `${String(Math.round(value * 100))}%`;

export default function SurveyList() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Surveys</h1>
        <Button className="h-11">
          <Plus aria-hidden />
          New survey
        </Button>
      </div>

      {/* Phones: one card per survey. */}
      <ul className="mt-6 grid gap-3 md:hidden">
        {surveys.map((survey) => (
          <li key={survey.id}>
            <Link to="/admin/dashboard" className="block rounded-lg border p-4 hover:bg-accent">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{survey.title}</span>
                <SurveyStatusBadge status={survey.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {survey.completes} / {survey.target} completes · IR {percent(survey.incidence)}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up: table. */}
      <div className="mt-6 hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Survey</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Completes</TableHead>
              <TableHead className="text-right">Incidence</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow key={survey.id}>
                <TableCell className="font-medium">
                  <Link to="/admin/dashboard" className="hover:underline">
                    {survey.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <SurveyStatusBadge status={survey.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {survey.completes} / {survey.target}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {percent(survey.incidence)}
                </TableCell>
                <TableCell className="text-muted-foreground">{survey.updated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
