import type { Condition, QuestionConfigInput, SurveyDefinitionInput } from '@survey-dynata/shared';
import type { QuestionType } from '@survey-dynata/shared/db';

// Demo survey for contributors and local development: one question of every type, two
// screeners, two quota cells. Generic content only, never client material.

export const DEMO_SURVEY_ID = '019a0000-0000-7000-8000-000000000001';
/** Fake Dynata project ID for mock mode (the `project` parameter in entry links). */
export const DEMO_DYNATA_PROJECT_ID = 'DEMO-10001';

export interface DemoQuestion<T extends QuestionType = QuestionType> {
  code: string;
  type: T;
  text: string;
  config: QuestionConfigInput<T>;
  isScreener?: boolean;
  isAttentionCheck?: boolean;
  /** Ends the survey as screen-out when it matches. */
  screenOut?: Condition;
}

export interface DemoBlock {
  code: string;
  title: string;
  rotationGroup?: string;
  questions: DemoQuestion[];
}

/** Typed constructor: `config` is checked against the question type at compile time. */
function q<T extends QuestionType>(
  code: string,
  type: T,
  text: string,
  config: QuestionConfigInput<T>,
  extra: Pick<DemoQuestion, 'isScreener' | 'isAttentionCheck' | 'screenOut'> = {},
): DemoQuestion {
  return { code, type, text, config, ...extra };
}

const options = (...labels: [id: string, label: string][]) =>
  labels.map(([id, label]) => ({ id, label }));

const agreement = options(
  ['1', 'Strongly disagree'],
  ['2', 'Disagree'],
  ['3', 'Neutral'],
  ['4', 'Agree'],
  ['5', 'Strongly agree'],
);

export const barKinds = options(
  ['chocolate', 'Chocolate bars'],
  ['muesli', 'Muesli bars'],
  ['oat', 'Oat bars / flapjacks'],
  ['fruit_nut', 'Fruit and nut bars'],
  ['protein', 'Protein bars'],
);

export const products = [
  { id: 'choco_crunch', label: 'Choco Crunch' },
  { id: 'golden_oat', label: 'Golden Oat' },
  { id: 'nutty_date', label: 'Nutty Date' },
  { id: 'power_pro', label: 'Power Pro' },
];

export const packs = [
  { id: 'pack_a', label: 'Pack A (bar shown)', imageUrl: '/demo/pack.svg' },
  { id: 'pack_b', label: 'Pack B (ingredients only)', imageUrl: '/demo/pack.svg' },
];

export const demoSurvey = {
  id: DEMO_SURVEY_ID,
  title: 'Demo: Snack Bar Study',
  status: 'live',
  targetCompletes: 27,
  language: 'en',
} as const;

export const demoBlocks: DemoBlock[] = [
  {
    code: 'A',
    title: 'Screening',
    questions: [
      q(
        'A1',
        'number',
        'How old are you?',
        { min: 0, max: 120, unit: 'years' },
        {
          isScreener: true,
          screenOut: {
            any: [
              { question: 'A1', op: 'lt', value: 18 },
              { question: 'A1', op: 'gt', value: 69 },
            ],
          },
        },
      ),
      q(
        'A2',
        'single_choice',
        'What is your gender?',
        { options: options(['female', 'Female'], ['male', 'Male'], ['diverse', 'Diverse']) },
        { isScreener: true },
      ),
      q(
        'A3',
        'multi_choice',
        'Do you or anyone in your household work in one of these industries?',
        {
          options: [
            ...options(
              ['market_research', 'Market research'],
              ['advertising', 'Advertising or PR'],
              ['food_industry', 'Food or confectionery production'],
              ['retail', 'Retail'],
            ),
            { id: 'none', label: 'None of these', exclusive: true },
          ],
        },
        {
          isScreener: true,
          screenOut: {
            question: 'A3',
            op: 'includes_any',
            value: ['market_research', 'advertising', 'food_industry'],
          },
        },
      ),
    ],
  },
  {
    code: 'B',
    title: 'Shopping',
    rotationGroup: 'main',
    questions: [
      q('B1', 'single_choice', 'How often do you buy snack bars?', {
        options: options(
          ['weekly_plus', 'Several times a week'],
          ['weekly', 'About once a week'],
          ['monthly', 'Two or three times a month'],
          ['rarely', 'Less often'],
        ),
      }),
      q('B2', 'multi_choice', 'Which kinds of bars have you bought in the last 3 months?', {
        options: [...barKinds, { id: 'none', label: 'None of these', exclusive: true }],
        randomize: true,
      }),
      q('B3', 'grid_single', 'How much do you agree with each statement?', {
        rows: options(
          ['list', 'Snack bars are on my shopping list.'],
          ['offer', 'I buy snack bars when they are on offer.'],
          ['new', 'I like trying new bars.'],
          ['brand', 'I usually buy a brand I know.'],
        ),
        columns: agreement,
        randomizeRows: true,
      }),
      q('B4', 'grid_multi', 'Which kinds of bars fit these situations?', {
        rows: options(
          ['commute', 'On the way to work or university'],
          ['sport', 'Before or after sport'],
          ['treat', 'As a treat on the sofa'],
        ),
        columns: barKinds,
      }),
      q('B5', 'number', 'How many snack bars do you eat in a typical week?', {
        min: 0,
        max: 50,
        unit: 'bars',
      }),
      q('B6', 'rating', 'How likely are you to recommend your favourite bar to a friend?', {
        min: 0,
        max: 10,
        lowLabel: 'Not at all likely',
        highLabel: 'Extremely likely',
      }),
    ],
  },
  {
    code: 'C',
    title: 'Products',
    rotationGroup: 'main',
    questions: [
      q('C1', 'info', 'Next, some snack bars', {
        body: 'On the next screens you will see some snack bars. There are no right or wrong answers.',
      }),
      q('C2', 'slider', 'Do you eat these bars more as a treat or to eat healthily?', {
        min: 1,
        max: 7,
        lowLabel: 'Pure treat',
        highLabel: 'Pure self-improvement',
        items: products,
        allowNotApplicable: true,
      }),
      q('C3', 'semantic_differential', 'How do you expect this bar to taste?', {
        pairs: [
          { id: 'juicy', left: 'Dry', right: 'Juicy' },
          { id: 'soft', left: 'Hard', right: 'Soft' },
          { id: 'flavour', left: 'Bland', right: 'Flavourful' },
          { id: 'natural', left: 'Artificial', right: 'Natural' },
        ],
        points: 7,
        stimulus: packs[0],
      }),
      q('C4', 'maxdiff', 'Which is most and which is least important when buying a bar?', {
        items: options(
          ['taste', 'Taste'],
          ['price', 'Low price'],
          ['protein', 'High protein'],
          ['sugar', 'Little sugar'],
          ['natural', 'Few natural ingredients'],
          ['brand', 'Known brand'],
        ),
        itemsPerSet: 3,
        // Each item appears twice across the four sets.
        sets: [
          ['taste', 'price', 'protein'],
          ['sugar', 'natural', 'brand'],
          ['taste', 'sugar', 'natural'],
          ['price', 'protein', 'brand'],
        ],
      }),
      q(
        'C5',
        'constant_sum',
        'If you bought Power Pro, what would you buy less of? Share 10 points.',
        {
          options: options(
            ['other_protein', 'Other protein bars'],
            ['oat', 'Oat bars'],
            ['chocolate', 'Chocolate bars'],
            ['nothing', 'Nothing, I would buy it in addition'],
          ),
          total: 10,
        },
      ),
      q('C6', 'mapping', 'Place the bars on the map.', {
        stimuli: products,
        xAxis: { left: 'Breakfast and muesli', right: 'Sweets and snacks' },
        yAxis: { bottom: 'Treat', top: 'Self-improvement' },
        mobile: 'sliders',
      }),
      q('C7', 'click_map', 'In a supermarket you do not know, where would you look first?', {
        imageUrl: '/demo/store-layout.svg',
        imageAlt: 'Floor plan of a supermarket with six areas',
        zones: [
          {
            id: 'entrance',
            label: 'Entrance, fruit and vegetables',
            x: 0,
            y: 0,
            width: 33,
            height: 50,
          },
          { id: 'cereals', label: 'Muesli and cereals', x: 33, y: 0, width: 34, height: 50 },
          { id: 'sweets', label: 'Sweets', x: 67, y: 0, width: 33, height: 50 },
          { id: 'sports', label: 'Sports nutrition', x: 0, y: 50, width: 33, height: 50 },
          { id: 'drinks', label: 'Drinks', x: 33, y: 50, width: 34, height: 50 },
          { id: 'checkout', label: 'Checkout', x: 67, y: 50, width: 33, height: 50 },
        ],
        targets: options(['chocolate', 'Chocolate bars'], ['protein', 'Protein bars']),
      }),
      q('C8', 'paired_comparison', 'Compare the two packs.', {
        items: packs,
        pairs: [['pack_a', 'pack_b']],
        questions: options(
          ['tasty', 'Which looks tastier?'],
          ['buy', 'Which would you rather buy?'],
        ),
      }),
      q('C9', 'timed_exposure', 'What kind of product was that?', {
        stimuli: packs,
        exposureMs: 3000,
        assignment: 'pack',
        options: options(
          ['bar', 'A bar'],
          ['cereal', 'Muesli or cereal'],
          ['dried_fruit', 'Dried fruit'],
          ['dont_know', 'Don’t know'],
        ),
      }),
    ],
  },
  {
    code: 'D',
    title: 'About you',
    questions: [
      q(
        'D1',
        'grid_single',
        'How much do you agree with each statement?',
        {
          rows: options(
            ['healthy', 'I pay attention to eating healthily.'],
            ['sweet', 'I often crave something sweet.'],
            ['attention', 'For this row, please select “Agree”.'],
            ['curious', 'I am curious about foods I do not know.'],
          ),
          columns: agreement,
        },
        { isAttentionCheck: true },
      ),
      q('D2', 'open_text', 'What would make snack bars better for you?', {
        minLength: 0,
        maxLength: 500,
      }),
      q('D3', 'single_choice', 'How many people live in your household?', {
        options: options(['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5+', '5 or more']),
      }),
    ],
  },
];

/** The attention-check row in D1 and the answer it expects. */
export const attentionCheck = { question: 'D1', row: 'attention', expected: '4' } as const;

export const demoQuotaCells = [
  {
    name: 'Women',
    conditions: { question: 'A2', op: 'equals', value: 'female' } satisfies Condition,
    target: 15,
  },
  {
    name: 'Men',
    conditions: { question: 'A2', op: 'equals', value: 'male' } satisfies Condition,
    target: 12,
  },
];

/** The demo survey in the import format (`pnpm survey:import` uses the same writer). */
export const demoDefinition: SurveyDefinitionInput = {
  survey: {
    id: DEMO_SURVEY_ID,
    title: demoSurvey.title,
    language: demoSurvey.language,
    targetCompletes: demoSurvey.targetCompletes,
  },
  blocks: demoBlocks,
  // Split cell for C9: each respondent sees one of the two packs.
  assignments: [{ name: 'pack', values: packs.map((pack) => pack.id) }],
  quotas: demoQuotaCells,
};
