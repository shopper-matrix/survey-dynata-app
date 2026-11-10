import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdmin } from '../AdminLayout';
import {
  adminApi,
  type QuestionInput,
  type QuotaInput,
  type SurveyDetails,
  type SurveyStatus,
} from '../api';
import { SurveyStatusBadge } from '../StatusBadge';
import { describeFailure, withConfirmation } from './changes';
import { DashboardPanel } from '../dashboard/DashboardPanel';
import { DynataSettingsPanel } from './DynataSettingsPanel';
import { QuestionEditor } from './QuestionEditor';
import { QuestionList } from './QuestionList';
import { QuotaEditor } from './QuotaEditor';
import { SettingsPanel } from './SettingsPanel';

const TABS = ['Questions', 'Quotas', 'Dashboard', 'Settings', 'Dynata'] as const;
type Tab = (typeof TABS)[number];

const NEXT_STATUS: Record<SurveyStatus, { status: SurveyStatus; label: string }[]> = {
  draft: [{ status: 'test', label: 'Start testing' }],
  test: [
    { status: 'draft', label: 'Back to draft' },
    { status: 'live', label: 'Go live' },
  ],
  live: [{ status: 'closed', label: 'Close survey' }],
  closed: [],
};

export default function SurveyBuilderPage() {
  const { id = '' } = useParams();
  const me = useAdmin();
  const canEdit = me.role !== 'viewer';
  const [details, setDetails] = useState<SurveyDetails | null>(null);
  const [editing, setEditing] = useState<{ blockCode: string; code: string | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newBlock, setNewBlock] = useState('');
  const [tab, setTab] = useState<Tab>('Questions');

  useEffect(() => {
    let active = true;
    void adminApi.survey(id).then((survey) => {
      if (active) setDetails(survey);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const apply = useCallback(async (change: () => Promise<SurveyDetails>) => {
    setMessage(null);
    try {
      setDetails(await change());
      return true;
    } catch (failure) {
      setMessage(describeFailure(failure));
      return false;
    }
  }, []);

  if (!details) return <p className="text-muted-foreground">Loading…</p>;

  const { definition } = details;
  const blocks = definition.blocks;
  const editingQuestion = editing?.code
    ? (blocks.flatMap((b) => b.questions).find((q) => q.code === editing.code) ?? null)
    : null;

  async function saveQuestion(blockCode: string, question: QuestionInput) {
    const ok = await apply(() =>
      withConfirmation((confirm) =>
        editing?.code
          ? adminApi.saveQuestion(id, editing.code, blockCode, question, confirm)
          : adminApi.addQuestion(id, blockCode, question, confirm),
      ),
    );
    if (ok) setEditing({ blockCode, code: question.code });
  }

  function saveQuota(previousName: string | null, quota: QuotaInput) {
    return apply(() =>
      withConfirmation((confirm) =>
        previousName
          ? adminApi.saveQuota(id, previousName, quota, confirm)
          : adminApi.addQuota(id, quota, confirm),
      ),
    );
  }

  function addBlock(event: SyntheticEvent) {
    event.preventDefault();
    const code = newBlock.trim();
    if (!code) return;
    void apply(() => adminApi.addBlock(id, { code, title: code })).then((ok) => {
      if (ok) setNewBlock('');
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{definition.survey.title}</h1>
        <SurveyStatusBadge status={details.status} paused={details.pausedAt !== null} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {details.respondents} respondents · target {definition.survey.targetCompletes} completes ·
        language {definition.survey.language}
      </p>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {NEXT_STATUS[details.status].map(({ status, label }) => (
            <Button
              key={status}
              variant="outline"
              className="h-11"
              onClick={() => void apply(() => adminApi.updateSurvey(id, { status }))}
            >
              {label}
            </Button>
          ))}
          {details.status === 'live' ? (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => void apply(() => adminApi.pause(id, details.pausedAt === null))}
            >
              {details.pausedAt === null ? 'Pause survey' : 'Resume survey'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <div role="tablist" aria-label="Survey sections" className="mt-6 flex gap-1 border-b">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={tab === name}
            onClick={() => {
              setTab(name);
            }}
            className={`h-11 border-b-2 px-4 text-sm font-medium ${
              tab === name
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Quotas' ? (
        <div role="tabpanel" aria-label="Quotas" className="mt-6">
          <QuotaEditor
            quotas={definition.quotas ?? []}
            counts={details.quotaCounts}
            canEdit={canEdit}
            onSave={saveQuota}
            onDelete={(name) =>
              void apply(() =>
                withConfirmation((confirm) => adminApi.deleteQuota(id, name, confirm)),
              )
            }
          />
        </div>
      ) : null}

      {tab === 'Dashboard' ? (
        <div role="tabpanel" aria-label="Dashboard" className="mt-6">
          <DashboardPanel surveyId={id} canEdit={canEdit} />
        </div>
      ) : null}

      {tab === 'Settings' ? (
        <div role="tabpanel" aria-label="Settings" className="mt-6">
          <SettingsPanel
            key={details.updatedAt}
            survey={definition.survey}
            canEdit={canEdit}
            onSave={(patch) => apply(() => adminApi.updateSurvey(id, { ...patch }))}
          />
        </div>
      ) : null}

      {tab === 'Dynata' ? (
        <div role="tabpanel" aria-label="Dynata" className="mt-6">
          <DynataSettingsPanel surveyId={id} entryUrl={details.entryUrl} canEdit={canEdit} />
        </div>
      ) : null}

      <div
        role="tabpanel"
        aria-label="Questions"
        hidden={tab !== 'Questions'}
        className="mt-6 grid gap-6"
      >
        {editing ? (
          <QuestionEditor
            key={editing.code ?? `new-${editing.blockCode}`}
            question={editingQuestion}
            blockCode={editing.blockCode}
            blockCodes={blocks.map((b) => b.code)}
            language={definition.survey.language}
            canEdit={canEdit}
            onSave={saveQuestion}
            {...(editing.code
              ? {
                  onDelete: async () => {
                    const code = editing.code ?? '';
                    if (
                      await apply(() =>
                        withConfirmation((confirm) => adminApi.deleteQuestion(id, code, confirm)),
                      )
                    ) {
                      setEditing(null);
                    }
                  },
                }
              : {})}
            onClose={() => {
              setEditing(null);
            }}
          />
        ) : null}

        <QuestionList
          blocks={blocks}
          canEdit={canEdit}
          selected={editing?.code ?? null}
          onSelect={(code) => {
            const block = blocks.find((b) => b.questions.some((q) => q.code === code));
            setEditing({ blockCode: block?.code ?? '', code });
          }}
          onAdd={(blockCode) => {
            setEditing({ blockCode, code: null });
          }}
          onReorder={(blockCode, codes) =>
            void apply(() => adminApi.reorderQuestions(id, blockCode, codes))
          }
          onDeleteBlock={(blockCode) => void apply(() => adminApi.deleteBlock(id, blockCode))}
        />

        {canEdit ? (
          <form onSubmit={addBlock} className="flex max-w-sm gap-2">
            <Input
              aria-label="New block code"
              placeholder="New block code, e.g. B"
              value={newBlock}
              onChange={(e) => {
                setNewBlock(e.target.value);
              }}
              className="h-11"
            />
            <Button type="submit" variant="outline" className="h-11">
              Add block
            </Button>
          </form>
        ) : null}
      </div>
    </>
  );
}
