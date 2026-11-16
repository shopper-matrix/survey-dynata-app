import { Languages } from 'lucide-react';

interface LanguageSwitchProps {
  languages: string[];
  current: string;
  /** Accessible name of the group, in the current language. */
  label: string;
  disabled?: boolean;
  onChange: (language: string) => void;
}

/** Each language in its own name, e.g. "Deutsch", "English". */
function nativeName(language: string): string {
  try {
    const name = new Intl.DisplayNames([language], { type: 'language' }).of(language);
    return name ? name.charAt(0).toLocaleUpperCase(language) + name.slice(1) : language;
  } catch {
    return language.toUpperCase();
  }
}

/** Lets respondents pick the survey language; hidden for surveys with one language. */
export function LanguageSwitch({
  languages,
  current,
  label,
  disabled,
  onChange,
}: LanguageSwitchProps) {
  if (languages.length < 2) return null;
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 text-sm">
      <Languages aria-hidden className="mr-1 size-4 text-muted-foreground" />
      {languages.map((language) => {
        const active = language === current;
        return (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={active}
            disabled={disabled === true || active}
            onClick={() => {
              onChange(language);
            }}
            className={
              active
                ? 'rounded-md bg-muted px-2 py-1 font-medium'
                : 'rounded-md px-2 py-1 text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50'
            }
          >
            {nativeName(language)}
          </button>
        );
      })}
    </div>
  );
}
