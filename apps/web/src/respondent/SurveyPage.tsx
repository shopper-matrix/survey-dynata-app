import { useCallback, useEffect, useMemo, useState } from 'react';
import { PrimaryButton } from '@/components/survey/PrimaryButton';
import { SurveyLayout } from '@/components/survey/SurveyLayout';
import { ApiError, sessionApi, type Screen } from './api';
import { EndView } from './EndView';
import { messagesFor } from './messages';
import { QuestionView } from './QuestionView';
import { WelcomeView } from './WelcomeView';

/**
 * The respondent survey at /survey: shows whatever screen the server says comes next. The
 * session cookie set by the entry link identifies the respondent.
 */
export function SurveyPage() {
  const [screen, setScreen] = useState<Screen | null>(null);
  // The language is decided by the server at entry; until the first screen, the browser's.
  const [language, setLanguage] = useState(() => navigator.language.slice(0, 2));
  const t = useMemo(() => messagesFor(language), [language]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((next: Screen) => {
    setScreen(next);
    if (!next.done && next.language) setLanguage(next.language);
  }, []);

  const run = useCallback(
    async (action: () => Promise<Screen>) => {
      setBusy(true);
      setError(null);
      try {
        show(await action());
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === 'bot_check_failed')
          setError(t.botCheckFailed);
        else if (failure instanceof ApiError && failure.status === 401) setError(t.noSession);
        else setError(t.error);
      } finally {
        setBusy(false);
      }
    },
    [show, t],
  );

  // Every question answered: end the session (the server decides the outcome).
  const finished = screen?.done === true && !screen.redirectUrl;
  useEffect(() => {
    if (!finished) return;
    let active = true;
    sessionApi
      .finish()
      .then((next) => {
        if (active) show(next);
      })
      .catch(() => {
        if (active) setError(t.error);
      });
    return () => {
      active = false;
    };
  }, [finished, show, t]);

  // First load: state is only set once the request settles.
  useEffect(() => {
    let active = true;
    sessionApi
      .current()
      .then((next) => {
        if (active) show(next);
      })
      .catch((failure: unknown) => {
        if (active)
          setError(failure instanceof ApiError && failure.status === 401 ? t.noSession : t.error);
      });
    return () => {
      active = false;
    };
  }, [show, t]);

  if (!screen) {
    return (
      <SurveyLayout
        footer={
          error ? (
            <PrimaryButton
              onClick={() => {
                void run(sessionApi.current);
              }}
            >
              {t.retry}
            </PrimaryButton>
          ) : undefined
        }
      >
        <p role="status" className="text-muted-foreground">
          {error ?? t.loading}
        </p>
      </SurveyLayout>
    );
  }

  if (!screen.done && 'welcome' in screen) {
    return (
      <WelcomeView
        welcome={screen.welcome}
        t={t}
        busy={busy}
        error={error}
        onStart={(token) => {
          void run(() => sessionApi.start(token));
        }}
        onDecline={() => {
          void run(sessionApi.decline);
        }}
      />
    );
  }

  if (!screen.done) {
    const { question } = screen;
    return (
      <QuestionView
        key={question.code}
        question={question}
        progress={screen.progress}
        busy={busy}
        error={error}
        t={t}
        onSubmit={(value, meta) => {
          void run(() => sessionApi.answer(question.code, value, meta.responseTimeMs));
        }}
      />
    );
  }

  if (screen.redirectUrl) {
    return <EndView outcome={screen.outcome} redirectUrl={screen.redirectUrl} t={t} />;
  }

  return (
    <SurveyLayout>
      <p role="status" className="text-muted-foreground">
        {t.loading}
      </p>
    </SurveyLayout>
  );
}
