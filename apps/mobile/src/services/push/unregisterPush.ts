import { env } from '../../config/env';
import { clearRegisteredToken } from './pushStorage';
import { clearKnownPushToken, getKnownPushToken } from './pushTokenMemory';

/** Upper bound on how long the sign-out path may wait for the unregister call. */
export const UNREGISTER_TIMEOUT_MS = 4000;

export interface PushUnregisterRequest {
  /** The owner that is signing out, captured before local auth state is cleared. */
  ownerId: string | undefined;
  /** That owner's access token, captured before local auth state is cleared. */
  accessToken: string | undefined;
}

/**
 * Starts a best-effort `POST /api/devices/unregister` for the OUTGOING owner and forgets their
 * remembered registration. Returns a promise that never rejects (and settles within
 * UNREGISTER_TIMEOUT_MS), or null when there is nothing to unregister.
 *
 * Why this does not use `apiRequest`: sign-out clears the auth scope and bumps the session epoch
 * synchronously, and `apiRequest` deliberately fails closed in exactly that state. The request
 * therefore uses the bearer token and owner captured before that point, is sent for that owner only,
 * and is dispatched before the SDK revokes the session.
 */
export function beginPushUnregister({ ownerId, accessToken }: PushUnregisterRequest): Promise<void> | null {
  if (!ownerId) return null;

  const token = getKnownPushToken(ownerId);
  clearKnownPushToken(ownerId);
  void clearRegisteredToken(ownerId);

  if (!token || !accessToken) return null;

  try {
    const controller = new AbortController();
    const request = fetch(`${env.apiUrl}/api/devices/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });
    const timer = setTimeout(() => controller.abort(), UNREGISTER_TIMEOUT_MS);

    return request
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
  } catch {
    // Never let push cleanup interfere with sign-out.
    return null;
  }
}
