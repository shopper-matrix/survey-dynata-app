import { randomUUID } from 'node:crypto';
import { surveyDefinitionSchema } from '@survey-dynata/shared';
import type { RespondentStatus } from '@survey-dynata/shared/db';
import { createDb } from '../../apps/api/src/db.js';
import { createDynataClient } from '../../apps/api/src/dynata/client.js';
import { dynataConfig } from '../../apps/api/src/dynata/config.js';
import { createDynataProvider } from '../../apps/api/src/dynata/provider.js';
import { loadEnv } from '../../apps/api/src/env.js';
import type { EndOutcome } from '../../apps/api/src/providers/sample-provider.js';
import { surveyEntryUrl } from '../../apps/api/src/http/entry-url.js';
import { importSurvey } from '../../apps/api/src/survey-import/import-survey.js';

// Test survey and expected links for the end-to-end tests. Links come from the API's own
// sample provider, so the tests check exactly what Dynata would receive.

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const config = dynataConfig(env);
const provider = createDynataProvider({
  client: createDynataClient(config, { appBaseUrl: env.APP_BASE_URL }),
  config,
  appBaseUrl: env.APP_BASE_URL,
});

/** Answer labels of the test survey, in the order they are asked. */
export const ANSWERS = {
  qualifies: 'Yes',
  screensOut: 'No',
  openCell: 'Group A',
  fullCell: 'Group B',
  attentive: 'Option 3',
  inattentive: 'Option 1',
} as const;

const choice = (code: string, text: string, labels: string[], extra = {}) => ({
  code,
  type: 'single_choice',
  text,
  config: { options: labels.map((label, i) => ({ id: String(i + 1), label })) },
  ...extra,
});

export async function createTestSurvey() {
  const id = randomUUID();
  const definition = surveyDefinitionSchema.parse({
    survey: { id, title: 'E2E outcomes', language: 'en', targetCompletes: 100 },
    blocks: [
      {
        code: 'A',
        title: 'Questions',
        questions: [
          choice('S1', 'Do you buy snack bars?', [ANSWERS.qualifies, ANSWERS.screensOut], {
            isScreener: true,
            screenOut: { question: 'S1', op: 'equals', value: '2' },
          }),
          choice('G1', 'Which group are you in?', [ANSWERS.openCell, ANSWERS.fullCell]),
          choice('ATT', 'Please choose Option 3.', ['Option 1', 'Option 2', 'Option 3'], {
            isAttentionCheck: true,
            attentionAnswer: { expected: ['3'] },
          }),
        ],
      },
    ],
    quotas: [
      { name: 'Group A', target: 1000, conditions: { question: 'G1', op: 'equals', value: '1' } },
      { name: 'Group B', target: 1, conditions: { question: 'G1', op: 'equals', value: '2' } },
    ],
  });
  await db.$transaction((tx) => importSurvey(tx, definition, { status: 'live' }));
  // Group B is already full: choosing it ends the respondent as over-quota.
  await db.quotaCell.update({
    where: { surveyId_name: { surveyId: id, name: 'Group B' } },
    data: { currentCount: 1 },
  });

  const entryUrl = (psid: string) =>
    provider.testEntryUrl(surveyEntryUrl(env.APP_BASE_URL, id), psid);

  return {
    entryUrl,
    /** Where a respondent ends after finishing or being stopped in the survey. */
    endLink: (psid: string, outcome: EndOutcome) =>
      provider.endLink({ panelRespondentId: psid }, outcome),
    /** Links Dynata returns at entry (invalid signature, already finished). */
    entryLinks: async (psid: string) => provider.verifyEntry(entryUrl(psid)),
    respondents: (psid: string) =>
      db.respondent.findMany({
        where: { surveyId: id, panelRespondentId: psid },
        select: { status: true },
      }),
    status: async (psid: string): Promise<RespondentStatus | undefined> =>
      (await db.respondent.findFirst({ where: { surveyId: id, panelRespondentId: psid } }))?.status,
    remove: async () => {
      await db.answer.deleteMany({ where: { respondent: { surveyId: id } } });
      await db.survey.delete({ where: { id } });
      await db.$disconnect();
    },
  };
}

/** Panel IDs that are not test IDs (no TEST- prefix), so respondents count as real. */
export const newPanelId = () => `E2E-${randomUUID()}`;
