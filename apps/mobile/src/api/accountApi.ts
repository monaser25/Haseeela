import { ApiError, apiRequest } from './client';

/** Upper bound for the deletion request; an abort after dispatch is treated as "in progress". */
export const ACCOUNT_DELETION_TIMEOUT_MS = 60_000;

export type AccountDeletionResult =
  /** Server confirmed the deletion is complete. */
  | { status: 'deleted' }
  /**
   * Deletion intent is durably recorded, or the outcome is unknown after the request was sent.
   * The backend finishes it; the account must not be presented as active.
   */
  | { status: 'pending' }
  /** Provably not started (nothing recorded). Safe to retry. */
  | { status: 'failed' };

function readDeletionPending(responseBody: string | undefined): boolean | undefined {
  if (!responseBody) return undefined;
  try {
    const parsed: unknown = JSON.parse(responseBody);
    if (parsed && typeof parsed === 'object') {
      const flag = (parsed as { deletionPending?: unknown }).deletionPending;
      if (typeof flag === 'boolean') return flag;
    }
  } catch {
    // Not JSON (e.g. a gateway error page)
  }
  return undefined;
}

/**
 * Classifies a failure of `DELETE /api/user/delete`.
 *
 * `requestSent` is false only when the client threw before dispatching (no session, identity or
 * epoch mismatch): nothing reached the server, so a retry is safe.
 * Once the request was sent, the outcome is `failed` only when the server proves nothing was
 * recorded; anything ambiguous (network drop, abort/timeout, unparseable success, gateway 5xx
 * without the backend's contract) counts as `pending`, never as "account still active".
 */
export function classifyAccountDeletionError(error: unknown, requestSent: boolean): AccountDeletionResult {
  if (!requestSent) return { status: 'failed' };

  if (error instanceof ApiError) {
    const deletionPending = readDeletionPending(error.responseBody);
    if (deletionPending === true) return { status: 'pending' };
    if (deletionPending === false) return { status: 'failed' };
    // Without the contract field: 4xx (incl. 401 invalid session) is a definitive rejection,
    // but a 5xx may come from a gateway after the backend already did work.
    return error.status >= 500 ? { status: 'pending' } : { status: 'failed' };
  }

  return { status: 'pending' };
}

/**
 * Requests permanent deletion of the signed-in account. Never throws: every outcome is classified
 * so the caller can decide between "sign out locally" and "stay signed in and let the user retry".
 */
export async function requestAccountDeletion(options: {
  expectedOwnerId: string;
  expectedEpoch: number;
}): Promise<AccountDeletionResult> {
  let requestSent = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCOUNT_DELETION_TIMEOUT_MS);

  try {
    const body = await apiRequest<{ ok?: boolean } | null>('/api/user/delete', {
      method: 'DELETE',
      expectedOwnerId: options.expectedOwnerId,
      expectedEpoch: options.expectedEpoch,
      signal: controller.signal,
      onBeforeSend: () => {
        requestSent = true;
      },
    });
    return body?.ok === true ? { status: 'deleted' } : { status: 'pending' };
  } catch (error) {
    return classifyAccountDeletionError(error, requestSent);
  } finally {
    clearTimeout(timer);
  }
}
