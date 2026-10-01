/**
 * Plain React-independent auth-scope and session epoch tracker.
 * Decouples API client and React Query hooks from React component context,
 * preventing cyclic imports (api -> AuthProvider -> query -> PDF -> api).
 */

let currentSessionEpoch = 1;
// undefined = uninitialized (e.g. standalone unit test boundary where AuthProvider is not mounted)
// null = explicitly signed out
// string = authenticated user ID
let currentAuthUserId: string | null | undefined = undefined;

/**
 * Returns the current session epoch counter.
 * Only increments on logout, account identity changes, or cache clear.
 * Never increments on same-owner USER_UPDATED or TOKEN_REFRESHED.
 */
export function getSessionEpoch(): number {
  return currentSessionEpoch;
}

/**
 * Returns the synchronously tracked authenticated user ID.
 * - `undefined`: uninitialized scope
 * - `null`: explicitly signed out
 * - `string`: active user ID
 */
export function getCurrentAuthUserId(): string | null | undefined {
  return currentAuthUserId;
}

/**
 * Updates the synchronously tracked auth user ID.
 */
export function setAuthScope(userId: string | null | undefined): void {
  currentAuthUserId = userId;
}

/**
 * Increments the session epoch counter.
 * Invalidates any in-flight operations bound to previous epochs.
 */
export function bumpSessionEpoch(): number {
  currentSessionEpoch += 1;
  return currentSessionEpoch;
}

/**
 * Resets auth scope to uninitialized state and increments the session epoch.
 */
export function resetAuthScope(): void {
  currentAuthUserId = undefined;
  currentSessionEpoch += 1;
}
