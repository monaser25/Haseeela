import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Remembers the last token successfully registered for an owner so launches do not re-register
 * needlessly. The key is namespaced per owner and the stored owner is re-verified on read, so one
 * account's record can never be mistaken for another's.
 */
const KEY_PREFIX = 'haseela.push.registration.v1:';

const keyFor = (ownerId: string): string => `${KEY_PREFIX}${ownerId}`;

export async function readRegisteredToken(ownerId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ownerId?: unknown; token?: unknown };
    if (parsed.ownerId !== ownerId || typeof parsed.token !== 'string' || !parsed.token) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

export async function writeRegisteredToken(ownerId: string, token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(ownerId), JSON.stringify({ ownerId, token }));
  } catch {
    // Best effort: worst case the token is re-registered on the next launch.
  }
}

export async function clearRegisteredToken(ownerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(ownerId));
  } catch {
    // Best effort.
  }
}
