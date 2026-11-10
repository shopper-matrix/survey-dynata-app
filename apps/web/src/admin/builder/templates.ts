// A valid starting config for every question type, used when an editor adds a question or
// switches its type. Editors then adapt texts and items.

const options = [
  { id: '1', label: 'Option 1' },
  { id: '2', label: 'Option 2' },
];
const scale5 = [
  { id: '1', label: 'Strongly disagree' },
  { id: '2', label: 'Disagree' },
  { id: '3', label: 'Neutral' },
  { id: '4', label: 'Agree' },
  { id: '5', label: 'Strongly agree' },
];
const items = [
  { id: 'a', label: 'Item A' },
  { id: 'b', label: 'Item B' },
  { id: 'c', label: 'Item C' },
];

export const QUESTION_TYPES = [
  'single_choice',
  'multi_choice',
  'grid_single',
  'grid_multi',
  'open_text',
  'number',
  'rating',
  'slider',
  'semantic_differential',
  'maxdiff',
  'constant_sum',
  'mapping',
  'click_map',
  'paired_comparison',
  'timed_exposure',
  'info',
] as const;

export type QuestionTypeName = (typeof QUESTION_TYPES)[number];

export const TEMPLATES: Record<QuestionTypeName, Record<string, unknown>> = {
  single_choice: { options },
  multi_choice: { options: [...options, { id: 'none', label: 'None of these', exclusive: true }] },
  grid_single: { rows: [{ id: 'r1', label: 'Statement 1' }], columns: scale5 },
  grid_multi: { rows: [{ id: 'r1', label: 'Situation 1' }], columns: options },
  open_text: { minLength: 1, maxLength: 500 },
  number: { min: 0, max: 100 },
  rating: { min: 0, max: 10, lowLabel: 'Not at all likely', highLabel: 'Extremely likely' },
  slider: { min: 1, max: 7, lowLabel: 'Low', highLabel: 'High', items },
  semantic_differential: { pairs: [{ id: 'p1', left: 'Dry', right: 'Juicy' }], points: 7 },
  maxdiff: { items, itemsPerSet: 3, sets: [['a', 'b', 'c']] },
  constant_sum: { options, total: 10 },
  mapping: { stimuli: items, xAxis: { left: 'Left', right: 'Right' }, mobile: 'sliders' },
  click_map: {
    imageUrl: '/demo/store-layout.svg',
    imageAlt: 'Store floor plan',
    zones: [{ id: 'z1', label: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }],
    targets: [{ id: 't1', label: 'Target 1' }],
  },
  paired_comparison: {
    items: items.slice(0, 2),
    pairs: [['a', 'b']],
    questions: [{ id: 'q1', label: 'Which one do you prefer?' }],
  },
  timed_exposure: {
    stimuli: [{ id: 's1', label: 'Pack', imageUrl: '/demo/pack.svg' }],
    exposureMs: 3000,
    options,
  },
  info: { body: 'Text shown to respondents.' },
};
