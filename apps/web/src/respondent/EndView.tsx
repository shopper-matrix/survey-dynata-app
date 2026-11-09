import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SurveyLayout } from '@/components/survey/SurveyLayout';
import type { Messages } from './messages';

/** Short pause so respondents see the thank-you message before leaving (under a second). */
export const REDIRECT_DELAY_MS = 800;
/** If the page is still open after this, the redirect failed: offer a visible link. */
export const FALLBACK_DELAY_MS = 3000;

interface EndViewProps {
  outcome: string | undefined;
  redirectUrl: string;
  t: Messages;
}

/** "Thank you, redirecting…", then back to the panel with the session's end link (DSA-405). */
export function EndView({ outcome, redirectUrl, t }: EndViewProps) {
  const [showFallback, setShowFallback] = useState(false);
  const text =
    outcome && outcome in t.end ? t.end[outcome as keyof Messages['end']] : t.end.complete;

  useEffect(() => {
    const redirect = setTimeout(() => {
      window.location.replace(redirectUrl);
    }, REDIRECT_DELAY_MS);
    const fallback = setTimeout(() => {
      setShowFallback(true);
    }, FALLBACK_DELAY_MS);
    return () => {
      clearTimeout(redirect);
      clearTimeout(fallback);
    };
  }, [redirectUrl]);

  return (
    <SurveyLayout progress={100} progressLabel={t.progress}>
      <div role="status" className="mt-10 flex flex-col items-center text-center">
        {outcome === 'complete' ? (
          <CheckCircle2 aria-hidden className="size-12 text-primary" />
        ) : null}
        <h1 className="mt-4 text-2xl font-semibold">{text.title}</h1>
        <p className="mt-3 max-w-sm text-lg leading-relaxed text-muted-foreground">
          {text.message}
        </p>
        <p className="mt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 aria-hidden className="size-5 animate-spin" />
          {t.redirecting}
        </p>
        {showFallback ? (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">{t.notRedirected}</p>
            <Button asChild size="lg" className="mt-2 h-12 px-10 text-base">
              <a href={redirectUrl}>{t.continue}</a>
            </Button>
          </div>
        ) : null}
      </div>
    </SurveyLayout>
  );
}
