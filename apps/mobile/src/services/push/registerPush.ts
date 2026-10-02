import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiRequest } from '../../api/client';
import { getCurrentAuthUserId, getSessionEpoch } from '../../auth/authScope';
import { readRegisteredToken, writeRegisteredToken } from './pushStorage';
import { setKnownPushToken } from './pushTokenMemory';

export type PushRegistrationResult =
  | 'registered'
  | 'unchanged'
  | 'skipped-signed-out'
  | 'skipped-not-device'
  | 'skipped-unsupported-platform'
  | 'skipped-no-project-id'
  | 'skipped-permission'
  | 'skipped-token-unavailable'
  | 'stale'
  | 'failed';

export const ANDROID_DEFAULT_CHANNEL_ID = 'default';

const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

// Collapses concurrent runs for the same owner + session so effect re-runs never double-prompt.
let inFlight: { key: string; promise: Promise<PushRegistrationResult> } | null = null;

/**
 * Registers this device's Expo push token for the signed-in owner.
 *
 * Owner and session epoch are frozen before the first await and re-checked after every async
 * boundary (storage, permission prompt, token fetch, HTTP). A token is never registered, or
 * remembered, under an owner that is no longer current.
 *
 * The EAS project id comes from `expoConfig.extra.eas.projectId`, which is only populated once the
 * project is linked (EXPO_PUBLIC_EAS_PROJECT_ID, see app.config.js). Without it registration is skipped.
 */
export function registerDeviceForPush(): Promise<PushRegistrationResult> {
  const ownerId = getCurrentAuthUserId();
  const epoch = getSessionEpoch();
  if (typeof ownerId !== 'string') return Promise.resolve('skipped-signed-out');

  const key = `${ownerId}:${epoch}`;
  if (inFlight?.key === key) return inFlight.promise;

  const promise = runRegistration(ownerId, epoch).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { key, promise };
  return promise;
}

async function runRegistration(ownerId: string, epoch: number): Promise<PushRegistrationResult> {
  const isCurrent = (): boolean => getCurrentAuthUserId() === ownerId && getSessionEpoch() === epoch;

  try {
    if (!Device.isDevice) return 'skipped-not-device';

    const platform = Platform.OS;
    if (platform !== 'ios' && platform !== 'android') return 'skipped-unsupported-platform';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string' || !projectId) return 'skipped-no-project-id';

    const remembered = await readRegisteredToken(ownerId);
    if (!isCurrent()) return 'stale';
    // Lets sign-out unregister synchronously even before this run reaches the token fetch.
    if (remembered) setKnownPushToken(ownerId, remembered);

    if (platform === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      if (!isCurrent()) return 'stale';
    }

    // Prompt only while the OS has never asked. A denial is respected: we never re-prompt, the user
    // can enable notifications from system settings.
    let permission = await Notifications.getPermissionsAsync();
    if (!isCurrent()) return 'stale';
    if (!permission.granted && permission.status === 'undetermined' && permission.canAskAgain !== false) {
      permission = await Notifications.requestPermissionsAsync();
      if (!isCurrent()) return 'stale';
    }
    if (!permission.granted) return 'skipped-permission';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!isCurrent()) return 'stale';
    if (typeof token !== 'string' || !EXPO_TOKEN_PATTERN.test(token)) return 'skipped-token-unavailable';

    setKnownPushToken(ownerId, token);
    if (remembered === token) return 'unchanged';

    await apiRequest<{ ok: boolean }>('/api/devices/register', {
      method: 'POST',
      body: { token, platform },
      expectedOwnerId: ownerId,
      expectedEpoch: epoch,
    });
    // apiRequest throws on a stale response; this also covers a switch after it returned.
    if (!isCurrent()) return 'stale';

    await writeRegisteredToken(ownerId, token);
    if (!isCurrent()) return 'stale';
    return 'registered';
  } catch {
    // Push is best effort and must never surface an error to the user. Nothing sensitive is logged.
    return isCurrent() ? 'failed' : 'stale';
  }
}
