import { questionDefinitionSchema } from '@survey-dynata/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { QuestionInput } from '../api';
import { PhonePreview } from './PhonePreview';
import { QUESTION_TYPES, TEMPLATES, type QuestionTypeName } from './templates';

const LIST_KEYS = ['options', 'rows', 'columns'] as const;
const EXCLUSIVE = ' (exclusive)';

interface ListItem {
  id: string;
  label: string;
  exclusive?: boolean;
}

/** "id: label" per line; a trailing "(exclusive)" marks "none of these" style options. */
const toLines = (items: ListItem[]) =>
  items.map((item) => `${item.id}: ${item.label}${item.exclusive ? EXCLUSIVE : ''}`).join('\n');

function fromLines(text: string): ListItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const exclusive = line.endsWith(EXCLUSIVE);
      const body = exclusive ? line.slice(0, -EXCLUSIVE.length) : line;
      const split = body.indexOf(':');
      const id = split === -1 ? String(index + 1) : body.slice(0, split).trim();
      const label = split === -1 ? body : body.slice(split + 1).trim();
      return { id, label, ...(exclusive ? { exclusive: true } : {}) };
    });
}

function parseJson(text: string): { value?: unknown; error?: string } {
  if (text.trim() === '') return {};
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { error: 'Not valid JSON' };
  }
}

const pretty = (value: unknown) => (value === undefined ? '' : JSON.stringify(value, null, 2));

interface QuestionEditorProps {
  question: QuestionInput | null;
  blockCode: string;
  blockCodes: string[];
  language: string;
  canEdit: boolean;
  onSave: (blockCode: string, question: QuestionInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function QuestionEditor(props: QuestionEditorProps) {
  const initial = props.question;
  const [code, setCode] = useState(initial?.code ?? '');
  const [type, setType] = useState<QuestionTypeName>(initial?.type ?? 'single_choice');
  const [text, setText] = useState(initial?.text ?? '');
  const [blockCode, setBlockCode] = useState(props.blockCode);
  const [isScreener, setIsScreener] = useState(initial?.isScreener === true);
  const [isAttentionCheck, setIsAttentionCheck] = useState(initial?.isAttentionCheck === true);
  const [attentionRow, setAttentionRow] = useState(initial?.attentionAnswer?.row ?? '');
  const [attentionExpected, setAttentionExpected] = useState(
    initial?.attentionAnswer?.expected.join(', ') ?? '',
  );
  const [configText, setConfigText] = useState(pretty(initial?.config ?? TEMPLATES.single_choice));
  const [displayLogicText, setDisplayLogicText] = useState(pretty(initial?.displayLogic));
  const [screenOutText, setScreenOutText] = useState(pretty(initial?.screenOut));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const config = parseJson(configText);
  const displayLogic = parseJson(displayLogicText);
  const screenOut = parseJson(screenOutText);
  const expectedIds = attentionExpected
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const attentionAnswer =
    isAttentionCheck && expectedIds.length > 0
      ? { ...(attentionRow.trim() ? { row: attentionRow.trim() } : {}), expected: expectedIds }
      : undefined;

  const candidate = useMemo(
    () => ({
      code,
      type,
      text,
      config: config.value,
      isScreener,
      isAttentionCheck,
      notes: initial?.notes ?? [],
      translations: initial?.translations ?? {},
      ...(displayLogic.value === undefined ? {} : { displayLogic: displayLogic.value }),
      ...(screenOut.value === undefined ? {} : { screenOut: screenOut.value }),
      ...(attentionAnswer ? { attentionAnswer } : {}),
    }),
    [
      code,
      type,
      text,
      config.value,
      isScreener,
      isAttentionCheck,
      displayLogic.value,
      screenOut.value,
      attentionRow,
      attentionExpected,
      initial,
    ],
  );
  const parsed = questionDefinitionSchema.safeParse(candidate);
  const problems = [
    config.error && `Config: ${config.error}`,
    displayLogic.error && `Display logic: ${displayLogic.error}`,
    screenOut.error && `Screen-out: ${screenOut.error}`,
    isAttentionCheck && !attentionAnswer && 'Attention check: enter the expected option id(s)',
    ...(parsed.success
      ? []
      : parsed.error.issues.map((i) => `${i.path.join('.') || 'question'}: ${i.message}`)),
  ].filter((p): p is string => typeof p === 'string');

  const configObject = (config.value ?? {}) as Record<string, unknown>;
  const setList = (key: string, lines: string) => {
    setConfigText(pretty({ ...configObject, [key]: fromLines(lines) }));
  };

  async function save() {
    if (!parsed.success) return;
    setSaving(true);
    setSaveError(null);
    try {
      await props.onSave(blockCode, candidate);
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : 'Saving failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="editor-heading"
      className="grid gap-6 rounded-lg border p-4 lg:grid-cols-[1fr_auto]"
    >
      <div className="grid min-w-0 gap-4">
        <h2 id="editor-heading" className="text-lg font-semibold">
          {initial ? `Edit ${initial.code}` : 'New question'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="q-code">Code</Label>
            <Input
              id="q-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
              }}
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="q-type">Type</Label>
            <select
              id="q-type"
              value={type}
              onChange={(e) => {
                const next = e.target.value as QuestionTypeName;
                setType(next);
                setConfigText(pretty(TEMPLATES[next]));
              }}
              className="h-11 rounded-md border bg-background px-3"
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="q-block">Block</Label>
            <select
              id="q-block"
              value={blockCode}
              onChange={(e) => {
                setBlockCode(e.target.value);
              }}
              className="h-11 rounded-md border bg-background px-3"
            >
              {props.blockCodes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="q-text">Question text</Label>
          <Textarea
            id="q-text"
            rows={2}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex min-h-11 items-center gap-2">
            <Checkbox
              checked={isScreener}
              onCheckedChange={(c) => {
                setIsScreener(c === true);
              }}
            />
            Screener
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <Checkbox
              checked={isAttentionCheck}
              onCheckedChange={(c) => {
                setIsAttentionCheck(c === true);
              }}
            />
            Attention check
          </label>
        </div>

        {isAttentionCheck ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="q-attention-row">Attention check row id (grids only)</Label>
              <Input
                id="q-attention-row"
                value={attentionRow}
                onChange={(e) => {
                  setAttentionRow(e.target.value);
                }}
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="q-attention-expected">Expected option id(s), comma-separated</Label>
              <Input
                id="q-attention-expected"
                value={attentionExpected}
                onChange={(e) => {
                  setAttentionExpected(e.target.value);
                }}
                className="h-11"
              />
            </div>
          </div>
        ) : null}

        {LIST_KEYS.filter((key) => Array.isArray(configObject[key])).map((key) => (
          <div key={key} className="grid gap-2">
            <Label htmlFor={`q-${key}`} className="capitalize">
              {key} (one per line, "id: label", add "{EXCLUSIVE.trim()}" for "none of these")
            </Label>
            <Textarea
              id={`q-${key}`}
              rows={5}
              value={toLines(configObject[key] as ListItem[])}
              onChange={(e) => {
                setList(key, e.target.value);
              }}
              className="font-mono text-sm"
            />
          </div>
        ))}

        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            Full configuration (JSON)
          </summary>
          <Textarea
            aria-label="Configuration JSON"
            rows={10}
            value={configText}
            onChange={(e) => {
              setConfigText(e.target.value);
            }}
            className="font-mono text-sm"
          />
        </details>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            Display logic and screen-out rule (JSON conditions)
          </summary>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="q-display">Show only when (empty = always)</Label>
              <Textarea
                id="q-display"
                rows={5}
                value={displayLogicText}
                onChange={(e) => {
                  setDisplayLogicText(e.target.value);
                }}
                className="font-mono text-sm"
                placeholder='{ "question": "A1", "op": "equals", "value": "1" }'
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="q-screenout">Screen out when (empty = never)</Label>
              <Textarea
                id="q-screenout"
                rows={5}
                value={screenOutText}
                onChange={(e) => {
                  setScreenOutText(e.target.value);
                }}
                className="font-mono text-sm"
                placeholder='{ "question": "A2", "op": "lt", "value": 18 }'
              />
            </div>
          </div>
        </details>

        {problems.length > 0 ? (
          <ul
            aria-label="Problems"
            className="list-disc rounded-md bg-destructive/10 py-2 pr-2 pl-6 text-sm text-destructive"
          >
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
        {saveError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {saveError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            className="h-11"
            disabled={!props.canEdit || problems.length > 0 || saving}
            onClick={() => void save()}
          >
            Save question
          </Button>
          <Button variant="outline" className="h-11" onClick={props.onClose}>
            Close
          </Button>
          {props.onDelete && props.canEdit ? (
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              onClick={() => void props.onDelete?.()}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      {parsed.success ? (
        <PhonePreview
          key={JSON.stringify(parsed.data.config) + text + type}
          question={{ code: code || 'Q', type, text, config: parsed.data.config }}
          language={props.language}
        />
      ) : null}
    </section>
  );
}
