import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { SurveyLayout } from '@/components/survey/SurveyLayout';

interface EndScreenProps {
  outcome: 'complete' | 'screenout';
}

const copy = {
  complete: {
    title: 'Thank you!',
    message: 'Your answers have been saved. Taking you back to your panel…',
  },
  screenout: {
    title: 'Thank you for your time',
    message:
      'This survey is looking for a different profile, so it ends here. Taking you back to your panel…',
  },
} as const;

/**
 * Shown for under a second before the redirect to Dynata (DSA-405). In the prototype the
 * "Continue" fallback leads back to the screen overview instead of a real end link.
 */
export function EndScreen({ outcome }: EndScreenProps) {
  const { title, message } = copy[outcome];

  return (
    <SurveyLayout progress={100}>
      <div className="mt-16 flex flex-col items-center text-center" role="status">
        {outcome === 'complete' ? (
          <CheckCircle2 aria-hidden className="size-12 text-primary" />
        ) : null}
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-sm text-lg leading-relaxed text-muted-foreground">{message}</p>
        <Loader2 aria-hidden className="mt-6 size-6 animate-spin text-muted-foreground" />
        <p className="mt-8 text-sm text-muted-foreground">Not redirected?</p>
        <Button asChild variant="outline" size="lg" className="mt-2 h-11">
          <Link to="/">Continue</Link>
        </Button>
      </div>
    </SurveyLayout>
  );
}
