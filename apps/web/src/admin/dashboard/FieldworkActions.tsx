import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminApi } from '../api';
import { describeFailure } from '../builder/changes';

/** Test links (DSA-606) and data export (DSA-607) for editors. */
export function FieldworkActions({ surveyId }: { surveyId: string }) {
  const [links, setLinks] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setMessage(null);
    try {
      await action();
    } catch (failure) {
      setMessage(describeFailure(failure));
    }
  }

  return (
    <section aria-label="Test links and export" className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11"
          onClick={() =>
            void run(async () => {
              setLinks((await adminApi.testLinks(surveyId, 5)).links);
            })
          }
        >
          Create 5 test links
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() =>
            void run(async () => {
              if (!window.confirm('Delete all test respondents and their answers?')) return;
              const { deleted } = await adminApi.deleteTestData(surveyId);
              setMessage(`Deleted ${String(deleted)} test respondents.`);
            })
          }
        >
          Delete test data
        </Button>
        <Button asChild variant="outline" className="h-11">
          <a href={adminApi.exportUrl(surveyId, 'csv')}>Export CSV</a>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <a href={adminApi.exportUrl(surveyId, 'sav')}>Export SPSS</a>
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {links.length > 0 ? (
        <ul aria-label="Test links" className="grid gap-1 font-mono text-xs break-all">
          {links.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer" className="hover:underline">
                {link}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
