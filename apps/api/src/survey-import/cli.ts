// `pnpm survey:import <file.json>`: validates a survey definition and writes it as a draft.
// Paths are relative to where the command was run (pnpm sets INIT_CWD).
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { surveyDefinitionSchema } from '@survey-dynata/shared';
import { createDb } from '../db.js';
import { loadEnv } from '../env.js';
import { importSurvey } from './import-survey.js';

try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // No .env file: rely on the environment.
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: pnpm survey:import <survey-definition.json>');
  process.exit(1);
}

const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
const parsed = surveyDefinitionSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
if (!parsed.success) {
  console.error(`${path} is not a valid survey definition:`);
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

const db = createDb(loadEnv().DATABASE_URL);
try {
  const result = await db.$transaction((tx) => importSurvey(tx, parsed.data), { timeout: 30_000 });
  console.log(
    `Imported "${parsed.data.survey.title}" (${result.surveyId}) as draft: ${String(result.questions)} questions.`,
  );
} finally {
  await db.$disconnect();
}
