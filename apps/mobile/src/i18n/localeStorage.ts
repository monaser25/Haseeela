import AsyncStorage from '@react-native-async-storage/async-storage';
import { Locale } from '@haseela/shared';
import { getDeviceLocale } from './deviceLocale';
import { syncI18nRTL } from './rtl';

export const LOCALE_STORAGE_KEY = '@haseela/locale';

export async function getStoredLocale(): Promise<Locale | null> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setStoredLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (err) {
    console.error('Failed to persist locale to AsyncStorage', err);
  }
}

/** Upper bound for the cold-start storage read; a stalled AsyncStorage must never hold the splash. */
export const LOCALE_INIT_TIMEOUT_MS = 2000;

function readStoredLocaleWithin(ms: number): Promise<Locale | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    getStoredLocale().then(
      (stored) => {
        clearTimeout(timer);
        resolve(stored);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/**
 * Initializes the application locale before first render:
 * 1. Loads persisted locale from AsyncStorage (or falls back to device locale) within a bounded
 *    time, so a stalled or failing storage read can never keep the app on the splash screen.
 * 2. Syncs the layout direction with the locale (never throws), so direction and language match
 *    even when the native RTL flag is stale (e.g. stored 'ar' but the native flag is still LTR).
 * 3. Always resolves with a locale.
 */
export async function initLocale(): Promise<Locale> {
  const stored = await readStoredLocaleWithin(LOCALE_INIT_TIMEOUT_MS);
  const locale = stored ?? getDeviceLocale();
  try {
    syncI18nRTL(locale);
  } catch {
    // Direction sync is best effort; the provider applies the direction in JS regardless.
  }
  return locale;
}
