'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { t as translate, type MessageKey, type MessageVars } from '../messages';
import { DEFAULT_LOCALE, dirFor, type Locale, type LocaleDir } from './locales';

type LocaleContextValue = {
  locale: Locale;
  dir: LocaleDir;
  t: (key: MessageKey, vars?: MessageVars) => string;
  setLocale: (locale: Locale) => void;
};

type LocaleProviderProps = {
  children: ReactNode;
  initialLocale?: Locale;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, initialLocale = DEFAULT_LOCALE }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('haseeela.locale') as Locale;
      if (stored === 'ar' || stored === 'en') {
        setLocale(stored);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const t = useCallback(
    (key: MessageKey, vars?: MessageVars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      dir: dirFor(locale),
      t,
      setLocale,
    }),
    [locale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
};

const ERROR_KEYS_MAP: Record<string, MessageKey> = {
  'Validation failed': 'errors.validationFailed',
  'Resource not found': 'errors.resourceNotFound',
  'Duplicate generated transaction for this billing date': 'errors.duplicateTransaction',
  'Your account is not fully set up. Please sign out and sign in again.': 'errors.accountNotSetup',
  'Internal server error': 'errors.internalServer',
  'Invalid date': 'errors.invalidDate',
  'Add at least one line item': 'errors.minLineItem',
  'Client not found': 'errors.clientNotFound',
  'Only monthly retainer clients can record recurring payments': 'errors.clientNotRetainer',
  'Only active clients can record recurring payments': 'errors.clientNotActive',
  'Subscription not found': 'errors.subNotFound',
  'Only active subscriptions can record payments': 'errors.subNotActive',
  'Using locally cached data. API sync will resume when the backend is available.': 'errors.cachedData',
  'Financial data is unavailable. Check the API connection and try again.': 'errors.dataUnavailable',
  'Amount must be greater than 0': 'errors.amountPositive',
  'Transaction not found': 'errors.transactionNotFound',
  'Only pending payments can be updated': 'errors.onlyPendingUpdate',
  'Only pending payments can be deleted': 'errors.onlyPendingDelete',
  'Payment is not pending': 'errors.paymentNotPending',
  'Only completed transactions can be reverted': 'errors.onlyCompletedRevert',
  'This transaction was not created from a pending payment': 'errors.notFromPending',
  'A transaction already exists for that date': 'errors.transactionDateCollision',
};

export const translateError = (msg: string, t: (key: MessageKey, vars?: MessageVars) => string) => {
  const key = Object.keys(ERROR_KEYS_MAP).find(k => msg.includes(k));
  if (key) return t(ERROR_KEYS_MAP[key]);
  return msg;
};
