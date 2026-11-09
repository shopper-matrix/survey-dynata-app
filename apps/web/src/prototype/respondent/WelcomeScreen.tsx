import { Clock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { demoSurvey } from '../fake-data';
import { progressPercent } from './flow';
import { RespondentPage } from './RespondentPage';

export function WelcomeScreen() {
  return (
    <RespondentPage
      progress={progressPercent('welcome')}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-4">
          <Button asChild size="lg" className="h-12 w-full text-base sm:w-auto sm:px-10">
            <Link to="/survey/single">Start</Link>
          </Button>
          {/* Declining ends the survey as a screen-out (DSA-402). */}
          <Button asChild variant="ghost" size="lg" className="h-11 w-full sm:w-auto">
            <Link to="/survey/end/screenout">No thanks</Link>
          </Button>
        </div>
      }
    >
      <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">{demoSurvey.title}</h1>
      <p className="mt-3 text-lg leading-relaxed">{demoSurvey.intro}</p>
      <p className="mt-4 flex items-center gap-2 text-muted-foreground">
        <Clock aria-hidden className="size-5" />
        About {demoSurvey.durationMinutes} minutes
      </p>

      <section
        aria-labelledby="privacy-heading"
        className="mt-8 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed"
      >
        <h2 id="privacy-heading" className="flex items-center gap-2 font-semibold">
          <ShieldCheck aria-hidden className="size-4" />
          Your privacy
        </h2>
        <p className="mt-2">
          We do not ask for your name, email or phone number. Your answers are stored securely, used
          only for research and deleted after the retention period. Data controller:{' '}
          {demoSurvey.controller}, {demoSurvey.contactEmail}.
        </p>
        <a
          href="#privacy-policy"
          className="mt-2 inline-block font-medium underline underline-offset-4"
        >
          Read the full privacy policy
        </a>
      </section>
    </RespondentPage>
  );
}
