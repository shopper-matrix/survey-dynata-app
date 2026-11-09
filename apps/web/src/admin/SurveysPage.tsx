import { Plus } from 'lucide-react';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdmin } from './AdminLayout';
import { adminApi, type SurveySummary } from './api';
import { SurveyStatusBadge } from './StatusBadge';

export default function SurveysPage() {
  const me = useAdmin();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveySummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('1000');

  useEffect(() => {
    let active = true;
    void adminApi.surveys().then((list) => {
      if (active) setSurveys(list);
    });
    return () => {
      active = false;
    };
  }, []);

  async function create(event: SyntheticEvent) {
    event.preventDefault();
    const created = await adminApi.createSurvey({
      title,
      targetCompletes: Number(target),
      language: 'de',
    });
    void navigate(`/admin/surveys/${created.id}`);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Surveys</h1>
        {me.role === 'viewer' ? null : (
          <Button
            className="h-11"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden />
            New survey
          </Button>
        )}
      </div>

      {creating ? (
        <form
          onSubmit={(event) => void create(event)}
          className="mt-6 grid max-w-xl gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
        >
          <div className="grid gap-2">
            <Label htmlFor="new-title">Title</Label>
            <Input
              id="new-title"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-target">Target completes</Label>
            <Input
              id="new-target"
              type="number"
              min={1}
              required
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
              }}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11">
            Create
          </Button>
        </form>
      ) : null}

      {surveys === null ? (
        <p className="mt-6 text-muted-foreground">Loading…</p>
      ) : surveys.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No surveys yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Survey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Completes</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="font-medium">
                    <Link to={`/admin/surveys/${survey.id}`} className="hover:underline">
                      {survey.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <SurveyStatusBadge status={survey.status} paused={survey.pausedAt !== null} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {survey.completes} / {survey.targetCompletes}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(survey.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
