import * as Localization from 'expo-localization';
import { Locale, DEFAULT_LOCALE } from '@haseela/shared';

/**
 * Detects the device locale using expo-localization.
 * If the primary device language is Arabic ('ar') or English ('en'), returns that;
 * otherwise defaults to 'en'.
 */
export function getDeviceLocale(): Locale {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const primaryLang = locales[0]?.languageCode?.toLowerCase();
      if (primaryLang === 'ar') return 'ar';
      if (primaryLang === 'en') return 'en';
    }
  } catch {
    // If running in an environment without native localization, fall back
  }
  return DEFAULT_LOCALE;
}
