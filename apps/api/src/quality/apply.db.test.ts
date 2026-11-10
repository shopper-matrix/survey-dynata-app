// Integration test: quality checks when a respondent finishes (DSA-501), against the database.
import { randomUUID } from 'node:crypto';
import { surveyDefinitionSchema, type QualitySettingsInput } from '@survey-dynata/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { importSurvey } from '../survey-import/import-survey.js';
import { applyQualityChecks } from './apply.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment (CI).
}

const db = createDb(loadEnv().DATABASE_URL);
const surveyIds: string[] = [];
const MINUTE = 60_000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE);
const options = ['1', '2', '3', '4'].map((id) => ({ id, label: `Option ${id}` }));

async function survey(quality: QualitySettingsInput, estimatedMinutes?: number) {
  const id = randomUUID();
  surveyIds.push(id);
  const definition = surveyDefinitionSchema.parse({
    survey: {
      id,
      title: 'Quality',
      language: 'de',
      targetCompletes: 10,
      quality,
      ...(estimatedMinutes ? { estimatedMinutes } : {}),
    },
    blocks: [
      {
        code: 'A',
        title: 'A',
        questions: [
          {
            code: 'G1',
            type: 'grid_single',
            text: 'Grid',
            config: { rows: options, columns: options },
          },
          {
            code: 'ATT',
            type: 'single_choice',
            text: 'Please choose 3',
            isAttentionCheck: true,
            attentionAnswer: { expected: ['3'] },
            config: { options },
          },
        ],
      },
    ],
  });
  const { questionIds } = await db.$transaction((tx) => importSurvey(tx, definition));

  return async (
    answers: { grid: string[]; attention: string },
    consentedAt: Date,
    flags: string[] = [],
  ) => {
    const respondent = await db.respondent.create({
      data: {
        surveyId: id,
        panelRespondentId: `P-${randomUUID()}`,
        consentedAt,
        qualityFlags: flags,
      },
    });
    await db.answer.createMany({
      data: [
        {
          respondentId: respondent.id,
          questionId: questionIds.get('G1') ?? '',
          value: { rows: Object.fromEntries(answers.grid.map((cell, i) => [String(i + 1), cell])) },
        },
        {
          respondentId: respondent.id,
          questionId: questionIds.get('ATT') ?? '',
          value: { optionId: answers.attention },
        },
      ],
    });
    const outcome = await db.$transaction((tx) =>
      applyQualityChecks(tx, { id: respondent.id, surveyId: id, isTest: false }, 'complete'),
    );
    const stored = await db.respondent.findUniqueOrThrow({ where: { id: respondent.id } });
    return { outcome, flags: stored.qualityFlags, id: respondent.id };
  };
}

const careful = { grid: ['1', '2', '3', '4'], attention: '3' };

afterAll(async () => {
  await db.answer.deleteMany({ where: { respondent: { surveyId: { in: surveyIds } } } });
  await db.survey.deleteMany({ where: { id: { in: surveyIds } } });
  await db.$disconnect();
});

describe('quality checks at finish (DSA-501)', () => {
  it('leaves careful respondents complete and unflagged', async () => {
    const finish = await survey({}, 10);
    expect(await finish(careful, ago(12))).toMatchObject({ outcome: 'complete', flags: [] });
  });

  it('terminates a failed attention check and keeps earlier flags', async () => {
    const finish = await survey({});
    const result = await finish({ ...careful, attention: '1' }, ago(12), ['duplicate_ip']);
    expect(result).toMatchObject({
      outcome: 'quality',
      flags: ['duplicate_ip', 'attention_check:ATT'],
    });
  });

  it('flags speeders and straightliners against the estimated length', async () => {
    const finish = await survey({}, 10);
    const result = await finish({ grid: ['2', '2', '2', '2'], attention: '3' }, ago(2));
    expect(result).toMatchObject({
      outcome: 'complete',
      flags: ['speeder', 'straightlining:G1'],
    });
  });

  it('uses the median of real completes once there are enough', async () => {
    const finish = await survey({ speeder: { action: 'terminate', minCompletesForMedian: 1 } });
    const first = await finish(careful, ago(30));
    // The first complete becomes the reference: 30 minutes, so under 10 minutes is a speeder.
    await db.respondent.update({
      where: { id: first.id },
      data: { status: 'complete', endedAt: new Date() },
    });
    expect((await finish(careful, ago(5))).outcome).toBe('quality');
    expect((await finish(careful, ago(15))).outcome).toBe('complete');
  });

  it('only checks completes', async () => {
    await expect(
      db.$transaction((tx) =>
        applyQualityChecks(
          tx,
          { id: randomUUID(), surveyId: randomUUID(), isTest: false },
          'screenout',
        ),
      ),
    ).resolves.toBe('screenout');
  });
});
