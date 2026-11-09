import type { AnswerValue } from '@survey-dynata/shared';
import type { DeviceType, RespondentStatus } from '@survey-dynata/shared/db';
import { BLOCK_ORDER_KEY } from '../survey-flow/types.js';
import { answerFor } from './demo-answers.js';
import { demoBlocks, packs, type DemoQuestion } from './demo-survey.js';
import { createRandom, type Random } from '../lib/random.js';

// 50 fake respondents across every outcome, with answers that match their status.
// Fixed seed and dates: the output is identical on every run.

export const RESPONDENT_MIX: Record<RespondentStatus, number> = {
  complete: 25,
  screenout: 10,
  overquota: 5,
  quality: 5,
  started: 3,
  abandoned: 2,
};

/** Completes per gender; must fit the quota targets in demo-survey.ts (Men is full). */
const COMPLETES_BY_GENDER = { female: 13, male: 12 } as const;

const FIELD_START = Date.UTC(2026, 10, 2, 7, 0); // 2 Nov 2026, 07:00 UTC
const MINUTE = 60_000;

export interface DemoAnswer {
  questionCode: string;
  value: AnswerValue;
  responseTimeMs: number | null;
  answeredAt: Date;
}

export interface DemoRespondent {
  panelRespondentId: string;
  status: RespondentStatus;
  deviceType: DeviceType;
  startedAt: Date;
  endedAt: Date | null;
  qualityFlags: string[];
  /** Same shape the flow engine stores: block order plus test groups. */
  assignments: Record<string, unknown>;
  answers: DemoAnswer[];
}

type QualityIssue = 'speeder' | 'attention_check' | 'straightlining';
const QUALITY_ISSUES: QualityIssue[] = ['speeder', 'attention_check', 'straightlining'];

const screening = demoBlocks.find((block) => block.code === 'A')?.questions ?? [];
const profile = demoBlocks.find((block) => block.code === 'D')?.questions ?? [];
const rotated = demoBlocks.filter((block) => block.rotationGroup === 'main');

function questionOrder(blockOrder: string[]): DemoQuestion[] {
  const middle = blockOrder.flatMap(
    (code) => rotated.find((block) => block.code === code)?.questions ?? [],
  );
  return [...screening, ...middle, ...profile];
}

/** Which questions a respondent answered, given how far they got. */
function answeredQuestions(
  status: RespondentStatus,
  order: DemoQuestion[],
  screenOutAt: 'A1' | 'A3',
  rng: Random,
): DemoQuestion[] {
  switch (status) {
    case 'complete':
    case 'quality':
      return order;
    case 'overquota':
      return screening; // Qualified, then stopped because the quota cell was full.
    case 'screenout':
      return order.slice(0, order.findIndex((question) => question.code === screenOutAt) + 1);
    case 'started':
    case 'abandoned':
      return order.slice(0, rng.int(screening.length + 1, order.length - profile.length));
  }
}

function screeningAnswer(
  code: string,
  gender: string,
  screenOutAt: 'A1' | 'A3' | null,
  rng: Random,
): AnswerValue | null {
  if (code === 'A1') {
    if (screenOutAt === 'A1') return { value: rng.pick([16, 17, 71, 74]) };
    return { value: rng.int(18, 69) };
  }
  if (code === 'A2') return { optionId: gender };
  if (code === 'A3') {
    return { optionIds: screenOutAt === 'A3' ? ['market_research'] : ['none'] };
  }
  return null;
}

export function buildDemoRespondents(seed = 2026): DemoRespondent[] {
  const rng = createRandom(seed);
  const statuses = rng.shuffle(
    Object.entries(RESPONDENT_MIX).flatMap(([status, count]) =>
      Array.from({ length: count }, () => status as RespondentStatus),
    ),
  );
  const completeGenders: string[] = rng.shuffle([
    ...Array.from({ length: COMPLETES_BY_GENDER.female }, () => 'female'),
    ...Array.from({ length: COMPLETES_BY_GENDER.male }, () => 'male'),
  ]);
  let screenouts = 0;

  return statuses.map((status, index) => {
    const startedAt = new Date(FIELD_START + index * 180 * MINUTE + rng.int(0, 120) * MINUTE);
    const qualityIssue = status === 'quality' ? rng.pick(QUALITY_ISSUES) : null;
    const screenOutAt = status === 'screenout' ? (screenouts++ % 2 === 0 ? 'A1' : 'A3') : null;
    const gender =
      status === 'complete'
        ? (completeGenders.pop() ?? 'female')
        : status === 'overquota'
          ? 'male' // The Men cell is full.
          : rng.pick(['female', 'male']);
    const deviceType = rng.pick<DeviceType>([
      'phone',
      'phone',
      'phone',
      'desktop',
      'desktop',
      'tablet',
    ]);
    const blockOrder = rng.shuffle(rotated.map((block) => block.code));
    const packVariant = rng.pick(packs).id;

    const questions = answeredQuestions(
      status,
      questionOrder(blockOrder),
      screenOutAt ?? 'A1',
      rng,
    );
    const secondsPerQuestion = qualityIssue === 'speeder' ? 5 : rng.int(15, 35);
    let clock = startedAt.getTime();

    const answers = questions.map((question): DemoAnswer => {
      clock += (secondsPerQuestion + rng.int(-4, 4)) * 1000;
      const value =
        screeningAnswer(question.code, gender, screenOutAt, rng) ??
        answerFor(question, {
          rng,
          deviceType,
          straightline: qualityIssue === 'straightlining',
          failAttention: qualityIssue === 'attention_check',
          packVariant,
        });
      return {
        questionCode: question.code,
        value,
        responseTimeMs: question.type === 'timed_exposure' ? rng.int(600, 2500) : null,
        answeredAt: new Date(clock),
      };
    });

    const finished = status !== 'started' && status !== 'abandoned';
    return {
      panelRespondentId: `TEST-${String(index + 1).padStart(4, '0')}`,
      status,
      deviceType,
      startedAt,
      endedAt: finished ? new Date(clock + 2000) : null,
      qualityFlags: qualityIssue ? [qualityIssue] : [],
      assignments: { [BLOCK_ORDER_KEY]: ['A', ...blockOrder, 'D'], pack: packVariant },
      answers,
    };
  });
}
