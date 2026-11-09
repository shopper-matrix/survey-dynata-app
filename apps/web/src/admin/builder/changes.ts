import { AdminApiError } from '../api';

/** Runs a change; if the survey is live and the API asks for confirmation, asks the editor. */
export async function withConfirmation<T>(change: (confirm: boolean) => Promise<T>): Promise<T> {
  try {
    return await change(false);
  } catch (failure) {
    const needsConfirm =
      failure instanceof AdminApiError && failure.code === 'confirmation_required';
    if (
      needsConfirm &&
      window.confirm('This survey is live. Change its screeners or quotas anyway?')
    ) {
      return change(true);
    }
    throw failure;
  }
}

/** Human-readable text for a failed admin API call. */
export function describeFailure(failure: unknown): string {
  if (!(failure instanceof AdminApiError)) return 'Something went wrong.';
  const details = Array.isArray(failure.details)
    ? (failure.details as { message?: string }[])
        .map((d) => d.message)
        .filter(Boolean)
        .join('; ')
    : '';
  return details ? `${failure.code}: ${details}` : failure.code;
}
