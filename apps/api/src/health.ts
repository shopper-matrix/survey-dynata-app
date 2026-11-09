import { APP_NAME } from '@survey-dynata/shared';

export interface HealthStatus {
  service: string;
  status: 'ok' | 'degraded';
  database: 'ok' | 'unreachable';
}

/** Reports API health; `pingDatabase` should reject when the database can't be reached. */
export async function getHealth(pingDatabase: () => Promise<void>): Promise<HealthStatus> {
  const service = `${APP_NAME} API`;
  try {
    await pingDatabase();
    return { service, status: 'ok', database: 'ok' };
  } catch {
    return { service, status: 'degraded', database: 'unreachable' };
  }
}
