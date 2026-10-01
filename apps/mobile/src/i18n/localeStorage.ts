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

/**
 * Initializes the application locale before first render:
 * 1. Loads persisted locale from AsyncStorage (or falls back to device locale).
 * 2. Immediately syncs I18nManager direction with the locale so direction and language match.
 * 3. Returns the resolved locale.
 */
export async function initLocale(): Promise<Locale> {
  const stored = await getStoredLocale();
  const locale = stored ?? getDeviceLocale();
  syncI18nRTL(locale);
  return locale;
}
