/**
 * In-memory record of the push token known for each signed-in owner.
 *
 * Sign-out clears local auth state synchronously, so by the time anything async could look the token
 * up in storage the owner is already gone. Keeping the token here lets the sign-out path read it
 * synchronously and still send a best-effort unregister for the outgoing owner.
 */
const knownTokens = new Map<string, string>();

export function setKnownPushToken(ownerId: string, token: string): void {
  knownTokens.set(ownerId, token);
}

export function getKnownPushToken(ownerId: string): string | undefined {
  return knownTokens.get(ownerId);
}

export function clearKnownPushToken(ownerId: string): void {
  knownTokens.delete(ownerId);
}

/** Test helper. */
export function resetKnownPushTokens(): void {
  knownTokens.clear();
}
