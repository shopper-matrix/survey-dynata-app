import { useEffect, useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminApi, type DynataSettings } from '../api';
import { describeFailure } from './changes';

interface Props {
  surveyId: string;
  entryUrl: string;
  canEdit: boolean;
}

/** The survey's Dynata project ID and the entry link to give Dynata (DSA-604). */
export function DynataSettingsPanel({ surveyId, entryUrl, canEdit }: Props) {
  const [settings, setSettings] = useState<DynataSettings | null>(null);
  const [projectId, setProjectId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void adminApi.dynata(surveyId).then((loaded) => {
      if (!active) return;
      setSettings(loaded);
      setProjectId(loaded.projectId ?? '');
    });
    return () => {
      active = false;
    };
  }, [surveyId]);

  async function save(event: SyntheticEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      setSettings(await adminApi.saveDynata(surveyId, projectId));
      setMessage('Saved.');
    } catch (failure) {
      const text = describeFailure(failure);
      setMessage(
        text === 'project_in_use' ? 'This project ID is already used by another survey.' : text,
      );
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(entryUrl);
    setCopied(true);
  }

  if (!settings) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <section aria-label="Dynata" className="grid max-w-xl gap-6">
      <div className="grid gap-2">
        <Label htmlFor="entry-url">Entry link for Dynata</Label>
        <div className="flex gap-2">
          <Input id="entry-url" readOnly value={entryUrl} className="h-11 font-mono" />
          <Button variant="outline" className="h-11" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <form onSubmit={(event) => void save(event)} className="grid gap-2">
        <Label htmlFor="project-id">Dynata project ID</Label>
        <div className="flex gap-2">
          <Input
            id="project-id"
            required
            readOnly={!canEdit}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
            }}
            className="h-11"
          />
          {canEdit ? (
            <Button type="submit" className="h-11">
              Save
            </Button>
          ) : null}
        </div>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </form>

      <p className="text-sm text-muted-foreground">
        Mode: <strong>{settings.mode}</strong>. The key ID and secret are server settings
        (environment variables) and are never shown here.
        {settings.mode === 'live' && !settings.keyConfigured ? ' No key is configured.' : ''}
      </p>
    </section>
  );
}
