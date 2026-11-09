import { APP_NAME } from '@survey-dynata/shared';

// Placeholder until the web framework is chosen.
export function pageTitle(page?: string): string {
  return page ? `${page} · ${APP_NAME}` : APP_NAME;
}
