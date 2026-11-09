/** Name shown by every app; proves the workspace link works end to end. */
export const APP_NAME = 'Survey Dynata App';

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export * from './conditions.js';
export * from './questions/config.js';
