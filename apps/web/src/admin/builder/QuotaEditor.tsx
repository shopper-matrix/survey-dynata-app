import { quotaDefinitionSchema } from '@survey-dynata/shared';
import { useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import type { QuotaInput } from '../api';

const EMPTY: QuotaInput = {
  name: '',
  kind: 'cap',
  target: 100,
  conditions: { question: 'Q1', op: 'equals', value: '1' },
};

interface Props {
  quotas: QuotaInput[];
  counts: Record<string, number>;
  canEdit: boolean;
  /** Saves a quota (`previousName` null = new). Resolves true on success. */
  onSave: (previousName: string | null, quota: QuotaInput) => Promise<boolean>;
  onDelete: (name: string) => void;
}

/** Quota cells with live progress, plus a form to create or edit one (DSA-604). */
export function QuotaEditor({ quotas, counts, canEdit, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<{ previousName: string | null } | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'cap' | 'minimum'>('cap');
  const [target, setTarget] = useState('100');
  const [conditions, setConditions] = useState('');

  function open(quota: QuotaInput | null) {
    const source = quota ?? EMPTY;
    setEditing({ previousName: quota?.name ?? null });
    setName(source.name);
    setKind(source.kind ?? 'cap');
    setTarget(String(source.target));
    setConditions(JSON.stringify(source.conditions, null, 2));
  }

  const parsed = (() => {
    try {
      return quotaDefinitionSchema.safeParse({
        name: name.trim(),
        kind,
        target: Number(target),
        conditions: JSON.parse(conditions) as unknown,
      });
    } catch {
      return null;
    }
  })();
  const problems = parsed
    ? parsed.success
      ? []
      : parsed.error.issues.map((issue) => `${issue.path.join('.') || 'quota'}: ${issue.message}`)
    : ['conditions: not valid JSON'];

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!editing || !parsed?.success) return;
    if (await onSave(editing.previousName, parsed.data)) setEditing(null);
  }

  return (
    <section aria-label="Quotas" className="grid gap-4">
      {quotas.length === 0 ? (
        <p className="text-muted-foreground">No quota cells yet.</p>
      ) : (
        <ul className="grid gap-3">
          {quotas.map((quota) => {
            const count = counts[quota.name] ?? 0;
            return (
              <li key={quota.name} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {quota.name}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {quota.kind === 'minimum' ? 'minimum' : 'cap'}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {count} / {quota.target}
                  </span>
                </div>
                <Progress
                  aria-label={`${quota.name} progress`}
                  value={Math.min(100, (count / quota.target) * 100)}
                  className="mt-2 h-2"
                />
                {canEdit ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        open(quota);
                      }}
                    >
                      Edit {quota.name}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        onDelete(quota.name);
                      }}
                    >
                      Delete {quota.name}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && !editing ? (
        <Button
          variant="outline"
          className="h-11 w-fit"
          onClick={() => {
            open(null);
          }}
        >
          Add quota
        </Button>
      ) : null}

      {editing ? (
        <form
          aria-label={editing.previousName ? `Edit quota ${editing.previousName}` : 'New quota'}
          onSubmit={(event) => void submit(event)}
          className="grid max-w-xl gap-4 rounded-lg border p-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="quota-name">Name</Label>
              <Input
                id="quota-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quota-kind">Kind</Label>
              <select
                id="quota-kind"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value === 'minimum' ? 'minimum' : 'cap');
                }}
                className="h-11 rounded-lg border border-input bg-transparent px-2.5"
              >
                <option value="cap">Cap (close when full)</option>
                <option value="minimum">Minimum (report only)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quota-target">Target</Label>
              <Input
                id="quota-target"
                type="number"
                min={1}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                }}
                className="h-11"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quota-conditions">Conditions (JSON)</Label>
            <Textarea
              id="quota-conditions"
              value={conditions}
              onChange={(e) => {
                setConditions(e.target.value);
              }}
              className="font-mono"
            />
          </div>
          {problems.length > 0 ? (
            <ul aria-label="Problems" className="list-disc pl-5 text-sm text-destructive">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" className="h-11" disabled={problems.length > 0}>
              Save quota
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                setEditing(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
