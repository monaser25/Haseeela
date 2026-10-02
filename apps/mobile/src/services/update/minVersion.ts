import Constants from 'expo-constants';
import { isVersionBelow, parseVersion } from '@haseela/shared';
import { env } from '../../config/env';

export const HEALTH_TIMEOUT_MS = 8000;

/** Android package id (D010). The Play Store URL is derived from it. */
export const ANDROID_PACKAGE = 'com.haseela.app';
export const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * App Store URL, supplied by config once the app has an App Store id (EXPO_PUBLIC_IOS_STORE_URL).
 * There is deliberately no hardcoded fallback: when absent, the update screen shows no store button.
 */
export function getIosStoreUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_IOS_STORE_URL?.trim();
  return url ? url : null;
}

export function getAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && parseVersion(version) ? version : null;
}

/**
 * Reads `minMobileVersion` from the unauthenticated /api/health endpoint.
 * Returns null on any failure or malformed response: callers must fail open.
 */
export async function fetchMinMobileVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.apiUrl}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { minMobileVersion?: unknown } | null;
    const min = body?.minMobileVersion;
    return typeof min === 'string' && parseVersion(min) ? min : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type UpdateCheckResult = 'update-required' | 'ok' | 'unknown';

export async function checkUpdateRequired(): Promise<UpdateCheckResult> {
  const current = getAppVersion();
  if (!current) return 'unknown';
  const min = await fetchMinMobileVersion();
  if (!min) return 'unknown';
  return isVersionBelow(current, min) ? 'update-required' : 'ok';
}
