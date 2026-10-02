import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
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
import { syncI18nRTL } from './rtl';
import { useCoverTransition } from '../components/motion/TransitionCover';
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
  /** Colour the language-switch transition dips through (the current screen background). */
  coverColor?: string;
}

export function I18nProvider({ children, initialLocale, coverColor }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? getDeviceLocale());
  const runTransition = useCoverTransition();

  // `committedRef` is what is on screen, `requestedRef` the latest locale asked for. They differ
  // only while a switch transition is in flight, so rapid toggles always end on the newest request.
  const committedRef = useRef<Locale>(locale);
  const requestedRef = useRef<Locale>(locale);

  const commitRequestedLocale = useCallback(() => {
    const next = requestedRef.current;
    if (committedRef.current === next) return;
    committedRef.current = next;
    // Layout direction is applied in JS below (root `direction` style); this only persists the
    // native flag for the next cold start and keeps I18nManager.isRTL equal to the runtime direction.
    syncI18nRTL(next);
    setLocaleState(next);
  }, []);

  const applyLocaleInstantly = useCallback(
    (next: Locale) => {
      requestedRef.current = next;
      commitRequestedLocale();
    },
    [commitRequestedLocale]
  );

  useEffect(() => {
    // Boot: the root resolves the stored/device locale asynchronously and passes it in. Adopt it
    // without a transition (the splash screen is still up).
    if (initialLocale) {
      applyLocaleInstantly(initialLocale);
      return;
    }
    // No explicit locale: read the stored one.
    let isMounted = true;
    getStoredLocale().then((stored) => {
      if (isMounted && stored) {
        applyLocaleInstantly(stored);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [initialLocale, applyLocaleInstantly]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (requestedRef.current === nextLocale) return;
      requestedRef.current = nextLocale;
      setStoredLocale(nextLocale);
      // Cross-fade: the app dips behind the cover while locale and direction swap together.
      runTransition(commitRequestedLocale, coverColor);
    },
    [runTransition, commitRequestedLocale, coverColor]
  );

  const toggleLocale = useCallback(() => {
    setLocale(requestedRef.current === 'ar' ? 'en' : 'ar');
  }, [setLocale]);

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

const styles = StyleSheet.create({
  directionRoot: {
    flex: 1,
  },
});

/**
 * Applies the layout direction in JS: Yoga mirrors rows, start/end padding and margins for the whole
 * subtree from this one `direction` style, so a language switch needs no native restart. Render it
 * once, directly under the provider.
 */
export function LayoutDirectionRoot({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return (
    <View testID="layout-direction-root" style={[styles.directionRoot, { direction: dir }]}>
      {children}
    </View>
  );
}

/**
 * Layout direction for visuals that must mirror (back arrows, chevrons). Reads the provider when
 * there is one and otherwise the runtime `I18nManager.isRTL`, so shared UI renders without a provider.
 */
export function useIsRTL(): boolean {
  const context = useContext(I18nContext);
  return context ? context.isRTL : I18nManager.isRTL;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
