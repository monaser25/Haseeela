import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Locale,
  MessageKey,
  dirFor,
  formatCurrency as sharedFormatCurrency,
  formatNumber as sharedFormatNumber,
  formatDate as sharedFormatDate,
} from '@haseela/shared';
import { translate, TranslationVars } from './translate';
import { getDeviceLocale } from './deviceLocale';
import { syncI18nRTL, promptRestartForRTL } from './rtl';
import { getStoredLocale, setStoredLocale } from './localeStorage';

export interface I18nContextValue {
  locale: Locale;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
  t: (key: MessageKey, vars?: TranslationVars) => string;
  setLocale: (nextLocale: Locale) => void;
  toggleLocale: () => void;
  formatCurrency: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? getDeviceLocale());

  useEffect(() => {
    // If no initialLocale was explicitly provided via props, check if a stored locale exists
    if (!initialLocale) {
      let isMounted = true;
      getStoredLocale().then((stored) => {
        if (isMounted && stored && stored !== locale) {
          syncI18nRTL(stored);
          setLocaleState(stored);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [initialLocale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setStoredLocale(nextLocale);
    setLocaleState((current) => {
      if (current === nextLocale) return current;
      const { directionChanged } = syncI18nRTL(nextLocale);
      if (directionChanged) {
        promptRestartForRTL(nextLocale);
      }
      return nextLocale;
    });
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const t = useCallback(
    (key: MessageKey, vars?: TranslationVars) => translate(locale, key, vars),
    [locale]
  );

  const formatCurrency = useCallback(
    (amount: number, currency = 'USD', options?: Intl.NumberFormatOptions) =>
      sharedFormatCurrency(amount, currency, locale, options),
    [locale]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      sharedFormatNumber(value, locale, options),
    [locale]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      sharedFormatDate(date, locale, options),
    [locale]
  );

  const dir = dirFor(locale);
  const isRTL = dir === 'rtl';

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      isRTL,
      dir,
      t,
      setLocale,
      toggleLocale,
      formatCurrency,
      formatNumber,
      formatDate,
    }),
    [locale, isRTL, dir, t, setLocale, toggleLocale, formatCurrency, formatNumber, formatDate]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
