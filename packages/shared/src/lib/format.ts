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
    currencyDisplay: 'narrowSymbol',
    ...options,
  });
}

// Amounts read number-then-symbol in both languages ("1,200.00 $"), like most finance apps here.
// Digits and symbols are direction-neutral, so the amount is wrapped in an LTR isolate to keep
// that order inside Arabic (RTL) paragraphs too.
const LRI = '⁦';
const PDI = '⁩';

export function currencySymbol(currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0).find((part) => part.type === 'currency')?.value || currency;
}

/** Number then symbol, Latin digits, same in Arabic and English: "1,200.00 $", "-45.50 $". */
export function formatCurrency(amount: number, currency: string, _locale: Locale, options?: NumberFormatOptions) {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    ...options,
  }).formatToParts(amount);
  const number = parts
    .filter((part) => part.type !== 'currency' && part.type !== 'literal')
    .map((part) => part.value)
    .join('');
  return `${LRI}${number} ${currencySymbol(currency)}${PDI}`;
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
