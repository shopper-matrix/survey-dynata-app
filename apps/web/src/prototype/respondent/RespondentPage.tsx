import type { ReactNode } from 'react';
import { ThemeToggle } from '@/app/ThemeToggle';
import { Progress } from '@/components/ui/progress';

interface RespondentPageProps {
  /** 0–100; omit to hide the progress bar. */
  progress?: number;
  children: ReactNode;
  /** Sticky action area: fixed at the bottom on phones, inline from 640 px. */
  footer?: ReactNode;
}

/** Calm, mobile-first frame shared by every respondent screen. */
export function RespondentPage({ progress, children, footer }: RespondentPageProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background">
        {progress === undefined ? null : (
          <Progress value={progress} aria-label="Survey progress" className="h-1 rounded-none" />
        )}
        <div className="mx-auto flex w-full max-w-xl justify-end px-4 pt-1">
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 sm:flex-none sm:pb-8">
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
