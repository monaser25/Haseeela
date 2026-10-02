import { intlTagFor, type Locale } from './locales';

type DateValue = Date | string | number;
export type DateFormatOptions = Intl.DateTimeFormatOptions;
export type NumberFormatOptions = Intl.NumberFormatOptions;

const toDate = (date: DateValue) => (date instanceof Date ? date : new Date(date));
const arabicMonthFormatter = new Intl.DateTimeFormat('ar-u-nu-latn', { month: 'long' });
const arabicYearFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric' });
const arabicDayFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' });

export function createDateFormatter(locale: Locale, options?: DateFormatOptions) {
  return new Intl.DateTimeFormat(intlTagFor(locale), {
    ...options,
    numberingSystem: 'latn',
  });
}

export function createNumberFormatter(locale: Locale, options?: NumberFormatOptions) {
  return new Intl.NumberFormat(intlTagFor(locale), {
    ...options,
    numberingSystem: 'latn',
  });
}

export function createCurrencyFormatter(currency: string, locale: Locale, options?: NumberFormatOptions) {
  return createNumberFormatter(locale, {
    style: 'currency',
    currency,
    currencyDisplay: locale === 'ar' ? 'name' : 'symbol',
    ...options,
  });
}

function formatArabicDate(date: Date, options?: DateFormatOptions) {
  const includeDay = options?.day !== undefined || (!options?.month && !options?.year);
  const includeMonth = options?.month !== undefined || (!options?.day && !options?.year);
  const includeYear = options?.year !== undefined || (!options?.day && !options?.month);

  const day = includeDay ? arabicDayFormatter.format(date) : '';
  const month = includeMonth ? arabicMonthFormatter.format(date) : '';
  const year = includeYear ? arabicYearFormatter.format(date) : '';

  if (day && month && year) return `${day} ${month}، ${year}`;
  if (day && month) return `${day} ${month}`;
  if (month && year) return `${month}، ${year}`;
  if (day && year) return `${day}، ${year}`;
  return day || month || year;
}

export function formatDate(date: DateValue, locale: Locale, options?: DateFormatOptions) {
  const value = toDate(date);
  if (locale === 'ar') return formatArabicDate(value, options);
  return createDateFormatter(locale, options).format(value);
}

export function formatCurrency(amount: number, currency: string, locale: Locale, options?: NumberFormatOptions) {
  return createCurrencyFormatter(currency, locale, options).format(amount);
}

export function formatNumber(value: number, locale: Locale, options?: NumberFormatOptions) {
  return createNumberFormatter(locale, options).format(value);
}

import { type MessageKey, type MessageVars } from '../messages';

export function formatTransactionName(name: string, t: (key: MessageKey, vars?: MessageVars) => string) {
  if (name.endsWith(' retainer payment')) {
    return name.replace(' retainer payment', t('tx.suffix.retainer'));
  }
  if (name.endsWith(' one-time payment')) {
    return name.replace(' one-time payment', t('tx.suffix.oneTime'));
  }
  if (name.endsWith(' subscription payment')) {
    return name.replace(' subscription payment', t('tx.suffix.subscription'));
  }
  return name;
}
