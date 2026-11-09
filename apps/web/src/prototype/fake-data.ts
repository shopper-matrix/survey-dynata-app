// Fake data for the UI prototype (DSA-105). Replaced by real API data in later stories.

export const demoSurvey = {
  title: 'Grocery Shopping Habits 2026',
  intro: 'We would like to learn how you shop for groceries. There are no right or wrong answers.',
  durationMinutes: 8,
  controller: 'ShopperMetrics GmbH',
  contactEmail: 'privacy@example.com',
};

export interface ChoiceOption {
  id: string;
  label: string;
}

export const ageQuestion = {
  text: 'How old are you?',
  hint: 'Choose one answer.',
  options: [
    { id: 'under18', label: 'Under 18' },
    { id: '18-24', label: '18–24' },
    { id: '25-34', label: '25–34' },
    { id: '35-44', label: '35–44' },
    { id: '45-54', label: '45–54' },
    { id: '55+', label: '55 or older' },
  ],
  /** Picking this option screens the respondent out (demonstrates the screener path). */
  screenOutOptionId: 'under18',
};

export const storesQuestion = {
  text: 'Where have you bought groceries in the last month?',
  hint: 'Choose all that apply.',
  options: [
    { id: 'supermarket', label: 'Large supermarket' },
    { id: 'discounter', label: 'Discount store' },
    { id: 'organic', label: 'Organic store' },
    { id: 'market', label: 'Farmers’ market' },
    { id: 'online', label: 'Online delivery' },
    { id: 'none', label: 'None of these' },
  ],
};

export const agreementScale: ChoiceOption[] = [
  { id: '1', label: 'Strongly disagree' },
  { id: '2', label: 'Disagree' },
  { id: '3', label: 'Neutral' },
  { id: '4', label: 'Agree' },
  { id: '5', label: 'Strongly agree' },
];

export const attitudesGrid = {
  text: 'How much do you agree with each statement?',
  rows: [
    { id: 'price', label: 'I compare prices before I buy.' },
    { id: 'list', label: 'I always shop with a list.' },
    { id: 'local', label: 'I prefer locally produced food.' },
    { id: 'attention', label: 'For this row, please select “Disagree”.' },
  ],
  columns: agreementScale,
};

export const openQuestion = {
  text: 'What would make your weekly shop easier?',
  hint: 'Please answer in a few words or sentences.',
  maxLength: 500,
};

export const numberQuestion = {
  text: 'How many times did you shop for groceries in the last 7 days?',
  hint: 'Enter a number from 0 to 50.',
  min: 0,
  max: 50,
};

export const ratingQuestion = {
  text: 'How likely are you to recommend your main grocery store to a friend?',
  lowLabel: 'Not at all likely',
  highLabel: 'Extremely likely',
  min: 0,
  max: 10,
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type SurveyStatus = 'draft' | 'test' | 'live' | 'closed';

export interface SurveySummary {
  id: string;
  title: string;
  status: SurveyStatus;
  completes: number;
  target: number;
  incidence: number;
  updated: string;
}

export const surveys: SurveySummary[] = [
  {
    id: 's1',
    title: 'Grocery Shopping Habits 2026',
    status: 'live',
    completes: 412,
    target: 800,
    incidence: 0.64,
    updated: '2026-11-09',
  },
  {
    id: 's2',
    title: 'Coffee Brand Tracker Q4',
    status: 'live',
    completes: 1180,
    target: 1200,
    incidence: 0.71,
    updated: '2026-11-08',
  },
  {
    id: 's3',
    title: 'Pet Food Concept Test',
    status: 'test',
    completes: 0,
    target: 400,
    incidence: 0,
    updated: '2026-11-07',
  },
  {
    id: 's4',
    title: 'Streaming Services Usage',
    status: 'draft',
    completes: 0,
    target: 1000,
    incidence: 0,
    updated: '2026-11-05',
  },
  {
    id: 's5',
    title: 'Summer Travel Plans 2026',
    status: 'closed',
    completes: 600,
    target: 600,
    incidence: 0.38,
    updated: '2026-08-30',
  },
];

export type RespondentStatus = 'complete' | 'in_progress' | 'screenout' | 'overquota' | 'quality';

export const fieldworkStats = {
  starts: 1035,
  completes: 412,
  screenouts: 371,
  overquotas: 58,
  qualityTerms: 29,
  incidence: 0.64,
  medianLoiMinutes: 7.6,
};

export const completesPerDay = [
  { day: 'Oct 27', completes: 18 },
  { day: 'Oct 28', completes: 25 },
  { day: 'Oct 29', completes: 31 },
  { day: 'Oct 30', completes: 29 },
  { day: 'Oct 31', completes: 22 },
  { day: 'Nov 1', completes: 14 },
  { day: 'Nov 2', completes: 12 },
  { day: 'Nov 3', completes: 34 },
  { day: 'Nov 4', completes: 41 },
  { day: 'Nov 5', completes: 38 },
  { day: 'Nov 6', completes: 36 },
  { day: 'Nov 7', completes: 40 },
  { day: 'Nov 8', completes: 33 },
  { day: 'Nov 9', completes: 39 },
];

export const quotaCells = [
  { name: 'Women 18–34', current: 118, target: 200 },
  { name: 'Women 35+', current: 152, target: 200 },
  { name: 'Men 18–34', current: 64, target: 200 },
  { name: 'Men 35+', current: 78, target: 200 },
];

export interface RecentRespondent {
  id: string;
  status: RespondentStatus;
  started: string;
  minutes: number | null;
  flags: string[];
}

export const recentRespondents: RecentRespondent[] = [
  { id: 'TEST-0412', status: 'complete', started: '14:52', minutes: 7.9, flags: [] },
  { id: 'TEST-0411', status: 'in_progress', started: '14:50', minutes: null, flags: [] },
  {
    id: 'TEST-0410',
    status: 'quality',
    started: '14:47',
    minutes: 1.8,
    flags: ['Speeder', 'Attention check'],
  },
  { id: 'TEST-0409', status: 'screenout', started: '14:45', minutes: 0.6, flags: [] },
  { id: 'TEST-0408', status: 'complete', started: '14:41', minutes: 8.4, flags: [] },
  { id: 'TEST-0407', status: 'overquota', started: '14:40', minutes: 1.1, flags: [] },
  {
    id: 'TEST-0406',
    status: 'complete',
    started: '14:36',
    minutes: 6.2,
    flags: ['Straightlining'],
  },
];
