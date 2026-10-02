export type Locale = 'en' | 'ar';

export type LocaleDir = 'ltr' | 'rtl';

export type LocaleConfig = {
  label: string;
  nativeLabel: string;
  dir: LocaleDir;
  intl: string;
};

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES = {
  en: {
    label: 'English',
    nativeLabel: 'English',
    dir: 'ltr',
    intl: 'en-US',
  },
  ar: {
    label: 'Arabic',
    nativeLabel: 'العربية',
    dir: 'rtl',
    intl: 'ar',
  },
} satisfies Record<Locale, LocaleConfig>;

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as Locale[];

export function isLocale(locale: string): locale is Locale {
  return locale in LOCALES;
}

export function dirFor(locale: Locale) {
  return LOCALES[locale].dir;
}

export function intlTagFor(locale: Locale) {
  return LOCALES[locale].intl;
}
