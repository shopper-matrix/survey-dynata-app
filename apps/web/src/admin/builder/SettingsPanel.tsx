import {
  qualitySettingsSchema,
  type QualityAction,
  type QualitySettings,
  type SurveyDefinitionInput,
} from '@survey-dynata/shared';
import { useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SurveySettings = SurveyDefinitionInput['survey'];

/** The PATCH body: empty fields are cleared (null). */
export interface SettingsPatch {
  intro: string | null;
  estimatedMinutes: number | null;
  privacyNotice: string | null;
  privacyPolicyUrl: string | null;
  retentionDays: number | null;
  quality: QualitySettings;
}

interface Props {
  survey: SurveySettings;
  canEdit: boolean;
  onSave: (patch: SettingsPatch) => Promise<boolean>;
}

const ACTIONS: { value: QualityAction; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'flag', label: 'Flag only' },
  { value: 'terminate', label: 'Terminate as quality' },
];

const CHECKS = [
  { key: 'speeder', label: 'Speeders' },
  { key: 'straightlining', label: 'Straightlining' },
  { key: 'attentionCheck', label: 'Attention checks' },
] as const;

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());
const numberOrNull = (text: string) => (text.trim() === '' ? null : Number(text));

/** Welcome screen, privacy and retention, and quality checks of one survey (DSA-504, DSA-501). */
export function SettingsPanel({ survey, canEdit, onSave }: Props) {
  const [intro, setIntro] = useState(survey.intro ?? '');
  const [minutes, setMinutes] = useState(String(survey.estimatedMinutes ?? ''));
  const [notice, setNotice] = useState(survey.privacyNotice ?? '');
  const [policyUrl, setPolicyUrl] = useState(survey.privacyPolicyUrl ?? '');
  const [retention, setRetention] = useState(String(survey.retentionDays ?? ''));
  const [quality, setQuality] = useState(() => qualitySettingsSchema.parse(survey.quality ?? {}));
  const [saved, setSaved] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setSaved(false);
    const ok = await onSave({
      intro: orNull(intro),
      estimatedMinutes: numberOrNull(minutes),
      privacyNotice: orNull(notice),
      privacyPolicyUrl: orNull(policyUrl),
      retentionDays: numberOrNull(retention),
      quality,
    });
    setSaved(ok);
  }

  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <form
      aria-label="Survey settings"
      onSubmit={(event) => void submit(event)}
      className="grid max-w-2xl gap-8"
    >
      <fieldset disabled={!canEdit} className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold">Welcome screen and privacy</legend>
        {field(
          'settings-intro',
          'Introduction',
          <Textarea
            id="settings-intro"
            value={intro}
            onChange={(e) => {
              setIntro(e.target.value);
            }}
          />,
        )}
        {field(
          'settings-minutes',
          'Estimated length (minutes)',
          <Input
            id="settings-minutes"
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
            }}
            className="h-11 w-32"
          />,
        )}
        {field(
          'settings-notice',
          'Privacy notice',
          <Textarea
            id="settings-notice"
            value={notice}
            onChange={(e) => {
              setNotice(e.target.value);
            }}
          />,
          'Shown on the welcome screen. Name the data controller and a contact.',
        )}
        {field(
          'settings-policy',
          'Privacy policy URL',
          <Input
            id="settings-policy"
            type="url"
            value={policyUrl}
            onChange={(e) => {
              setPolicyUrl(e.target.value);
            }}
            className="h-11"
          />,
        )}
        {field(
          'settings-retention',
          'Data retention (days)',
          <Input
            id="settings-retention"
            type="number"
            min={30}
            max={3650}
            value={retention}
            onChange={(e) => {
              setRetention(e.target.value);
            }}
            className="h-11 w-32"
          />,
          'Respondents and their answers are deleted this many days after they finished. Empty: kept.',
        )}
      </fieldset>

      <fieldset disabled={!canEdit} className="grid gap-4">
        <legend className="mb-2 text-lg font-semibold">Quality checks</legend>
        {CHECKS.map(({ key, label }) => (
          <div key={key} className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
            <Label htmlFor={`quality-${key}`}>{label}</Label>
            <select
              id={`quality-${key}`}
              value={quality[key].action}
              onChange={(e) => {
                const action = e.target.value as QualityAction;
                setQuality((current) => ({ ...current, [key]: { ...current[key], action } }));
              }}
              className="h-11 rounded-lg border border-input bg-transparent px-2.5"
            >
              {ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          Speeders: under {Math.round(quality.speeder.shareOfMedian * 100)}% of the median length.
          Straightlining: grids with {quality.straightlining.minRows}+ rows. Attention checks:{' '}
          {quality.attentionCheck.allowedFailures} failure(s) allowed.
        </p>
      </fieldset>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" className="h-11 w-fit">
            Save settings
          </Button>
          {saved ? (
            <p role="status" className="text-sm">
              Saved.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
