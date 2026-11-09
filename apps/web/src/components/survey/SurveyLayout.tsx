import type { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';

interface SurveyLayoutProps {
  /** 0–100; omit to hide the progress bar. */
  progress?: number;
  /** Accessible name of the progress bar (translated by the caller). */
  progressLabel?: string;
  children: ReactNode;
  /** Action area: fixed at the bottom on phones, inline from 640 px. */
  footer?: ReactNode;
}

/**
 * Calm, mobile-first frame for every respondent screen: thin progress bar on top, one column
 * of at most 36 rem, the main action reachable with the thumb. Light and dark follow the device.
 */
export function SurveyLayout({
  progress,
  progressLabel = 'Progress',
  children,
  footer,
}: SurveyLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background">
        {progress === undefined ? null : (
          <Progress value={progress} aria-label={progressLabel} className="h-1 rounded-none" />
        )}
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-28 sm:flex-none sm:pb-8">
        {children}
      </main>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto w-full max-w-xl sm:px-4 sm:pb-12">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}
