import { en, ar, MessageKey, Locale, DEFAULT_LOCALE } from '@haseela/shared';

export type TranslationVars = Record<string, string | number | null | undefined>;

/**
 * Translates a key for a given locale, with fallback to English then the key itself.
 * Supports string interpolation of `{placeholder}` variables.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: TranslationVars
): string {
  const dictionary = locale === 'ar' ? ar : en;
  const fallbackDictionary = en;

  // Primary lookup -> English fallback -> Raw key
  const template =
    (dictionary as Record<string, string>)[key] ??
    (fallbackDictionary as Record<string, string>)[key] ??
    key;

  if (!vars) {
    return template;
  }

  // Replace {paramName} with value from vars
  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    if (paramName in vars) {
      const val = vars[paramName];
      return val !== null && val !== undefined ? String(val) : '';
    }
    return match;
  });
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE) {
  return (key: MessageKey, vars?: TranslationVars) => translate(locale, key, vars);
}
