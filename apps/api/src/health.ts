import { APP_NAME } from '@survey-dynata/shared';

export interface HealthStatus {
  service: string;
  status: 'ok';
}

// Placeholder until the API framework is chosen.
export function getHealth(): HealthStatus {
  return { service: `${APP_NAME} API`, status: 'ok' };
}
