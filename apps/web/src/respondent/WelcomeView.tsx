import { Clock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/survey/ErrorMessage';
import { PrimaryButton } from '@/components/survey/PrimaryButton';
import { SurveyLayout } from '@/components/survey/SurveyLayout';
import type { Welcome } from './api';
import type { Messages } from './messages';
import { Turnstile } from './Turnstile';

interface WelcomeViewProps {
  welcome: Welcome;
  t: Messages;
  busy: boolean;
  error: string | null;
  onStart: (botCheckToken?: string) => void;
  onDecline: () => void;
}

/** Survey introduction, estimated length, privacy notice; Start is the only way in (DSA-402). */
export function WelcomeView({ welcome, t, busy, error, onStart, onDecline }: WelcomeViewProps) {
  const [token, setToken] = useState<string>();
  const waitingForBotCheck = welcome.botCheckSiteKey !== null && token === undefined;

  return (
    <SurveyLayout
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-4">
          <PrimaryButton
            busy={busy}
            disabled={waitingForBotCheck}
            onClick={() => {
              onStart(token);
            }}
          >
            {t.start}
          </PrimaryButton>
          <Button
            variant="ghost"
            size="lg"
            className="h-11 w-full sm:w-auto"
            disabled={busy}
            onClick={onDecline}
          >
            {t.decline}
          </Button>
        </div>
      }
    >
      <h1 className="text-2xl font-semibold sm:text-3xl">{welcome.title}</h1>
      {welcome.intro ? (
        <p className="mt-3 text-lg leading-relaxed whitespace-pre-line">{welcome.intro}</p>
      ) : null}
      {welcome.estimatedMinutes ? (
        <p className="mt-4 flex items-center gap-2 text-muted-foreground">
          <Clock aria-hidden className="size-5" />
          {t.about(welcome.estimatedMinutes)}
        </p>
      ) : null}

      <section
        aria-labelledby="privacy-heading"
        className="mt-8 rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed"
      >
        <h2 id="privacy-heading" className="flex items-center gap-2 font-semibold">
          <ShieldCheck aria-hidden className="size-4" />
          {t.privacyHeading}
        </h2>
        <p className="mt-2 whitespace-pre-line">{welcome.privacyNotice ?? t.privacyFallback}</p>
        {welcome.privacyPolicyUrl ? (
          <a
            href={welcome.privacyPolicyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-medium underline underline-offset-4"
          >
            {t.privacyPolicy}
          </a>
        ) : null}
      </section>

      {welcome.botCheckSiteKey ? (
        <Turnstile siteKey={welcome.botCheckSiteKey} onToken={setToken} />
      ) : null}
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
    </SurveyLayout>
  );
}
