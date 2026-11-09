import { Badge } from '@/components/ui/badge';
import type { RespondentStatus, SurveyStatus } from './api';

// Survey status colours (guide): green live, amber test, grey draft, blue closed. Text/background
// pairs meet WCAG AA in light and dark mode (checked in DSA-105).
const STYLES: Record<SurveyStatus, { label: string; className: string }> = {
  live: {
    label: 'Live',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  test: {
    label: 'Test',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  draft: {
    label: 'Draft',
    className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
  },
  closed: {
    label: 'Closed',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
};

export function SurveyStatusBadge({
  status,
  paused = false,
}: {
  status: SurveyStatus;
  paused?: boolean;
}) {
  const style = STYLES[status];
  return (
    <span className="inline-flex gap-1">
      <Badge variant="outline" className={`border-transparent ${style.className}`}>
        {style.label}
      </Badge>
      {paused ? (
        <Badge
          variant="outline"
          className="border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        >
          Paused
        </Badge>
      ) : null}
    </span>
  );
}

// Guide: green complete, amber in progress, grey screen-out, red quality term.
const RESPONDENT_STYLES: Record<RespondentStatus, { label: string; className: string }> = {
  complete: { label: 'Complete', className: STYLES.live.className },
  started: { label: 'In progress', className: STYLES.test.className },
  screenout: { label: 'Screen-out', className: STYLES.draft.className },
  overquota: { label: 'Over-quota', className: STYLES.closed.className },
  quality: {
    label: 'Quality term',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  abandoned: { label: 'Dropped out', className: STYLES.draft.className },
};

export function RespondentStatusBadge({ status }: { status: RespondentStatus }) {
  const style = RESPONDENT_STYLES[status];
  return (
    <Badge variant="outline" className={`border-transparent ${style.className}`}>
      {style.label}
    </Badge>
  );
}
