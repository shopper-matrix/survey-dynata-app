import type { DeviceType } from '@survey-dynata/shared/db';

/** Rough device class from the User-Agent; used for reporting, never for access decisions. */
export function deviceTypeFromUserAgent(userAgent: string | undefined): DeviceType {
  const ua = userAgent ?? '';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'phone';
  return 'desktop';
}
