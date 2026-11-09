import { Badge } from '@/components/ui/badge';
import type { RespondentStatus, SurveyStatus } from '../fake-data';

interface Style {
  label: string;
  className: string;
}

// Guide colours: green complete, amber in progress, grey screen-out, red quality term.
// Light: 800 text on 100 background; dark: 200 text on 900 background (both above 4.5:1).
const GREEN = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
const AMBER = 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
const GREY = 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
const RED = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
const BLUE = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';

const respondentStyles: Record<RespondentStatus, Style> = {
  complete: { label: 'Complete', className: GREEN },
  in_progress: { label: 'In progress', className: AMBER },
  screenout: { label: 'Screen-out', className: GREY },
  overquota: { label: 'Over-quota', className: BLUE },
  quality: { label: 'Quality term', className: RED },
};

const surveyStyles: Record<SurveyStatus, Style> = {
  live: { label: 'Live', className: GREEN },
  test: { label: 'Test', className: AMBER },
  draft: { label: 'Draft', className: GREY },
  closed: { label: 'Closed', className: BLUE },
};

function StyledBadge({ label, className }: Style) {
  return (
    <Badge variant="outline" className={`border-transparent ${className}`}>
      {label}
    </Badge>
  );
}

export function RespondentStatusBadge({ status }: { status: RespondentStatus }) {
  return <StyledBadge {...respondentStyles[status]} />;
}

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  return <StyledBadge {...surveyStyles[status]} />;
}
