import { CurrencyCode } from '../types/finance';
import { createCurrencyFormatter, type NumberFormatOptions } from './format';
import { DEFAULT_LOCALE, intlTagFor, type Locale } from './locales';

export const supportedCurrencies: { code: CurrencyCode; label: string }[] = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'EGP', label: 'EGP (E£)' },
  { code: 'SAR', label: 'SAR (ر.س)' },
  { code: 'AED', label: 'AED (د.إ)' },
];

export const isCurrencyCode = (value: unknown): value is CurrencyCode => (
  typeof value === 'string' && supportedCurrencies.some((currency) => currency.code === value)
);

export const getCurrencyLabel = (currency: CurrencyCode) => (
  supportedCurrencies.find((item) => item.code === currency)?.label || currency
);

export const makeCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => (
  createCurrencyFormatter(currency, locale, options)
);

// Unicode bidi isolates: wrap a string so it always renders as an isolated LTR
// run, regardless of the surrounding paragraph direction. This is the only way
// to guarantee a mixed number + Arabic-currency-name string like
// "12.00 دولار أمريكي" renders number-first inside an RTL layout — otherwise
// the bidi algorithm reorders the runs and you get "دولار أمريكي 12.00".
const LRI = '⁦';
const PDI = '⁩';
const ltrIsolate = (s: string) => `${LRI}${s}${PDI}`;

export const makeLongCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => {
  const currencyDefaults = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions();
  const defaultMax = currencyDefaults.maximumFractionDigits ?? 2;
  const defaultMin = currencyDefaults.minimumFractionDigits ?? defaultMax;
  const maximumFractionDigits = options?.maximumFractionDigits ?? defaultMax;
  const minimumFractionDigits = Math.min(
    options?.minimumFractionDigits ?? (options?.maximumFractionDigits === 0 ? 0 : defaultMin),
    maximumFractionDigits,
  );
  // The number itself is always rendered with Latin digits in en-US grouping
  // so it looks the same in Arabic and English mode.
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: options?.useGrouping,
  });
  // The currency *name* (e.g. "دولار أمريكي", "US dollars") is sourced from
  // the selected currency code so it changes when the user changes currency.
  const name = new Intl.NumberFormat(intlTagFor(locale), {
    style: 'currency',
    currency,
    currencyDisplay: 'name',
    numberingSystem: 'latn',
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value || currency;

  // Long format is *prose* (the currency name is a word, not a symbol), so we
  // let the surrounding paragraph direction control the visual order: in an
  // RTL paragraph the Arabic name sits to the left of the number, which is
  // the natural Arabic reading order; in an LTR paragraph the number leads.
  // (Compact format gets a different treatment below — see ltrIsolate.)
  return {
    format: (value: number) => `${number.format(value)} ${name}`,
    formatToParts: (value: number) => [
      ...number.formatToParts(value),
      { type: 'literal' as const, value: ' ' },
      { type: 'currency' as const, value: name },
    ],
  };
};

export const makeCompactCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => {
  const currencyDefaults = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions();
  const defaultMaximumFractionDigits = currencyDefaults.maximumFractionDigits ?? 2;
  const defaultMinimumFractionDigits = currencyDefaults.minimumFractionDigits ?? defaultMaximumFractionDigits;
  const maximumFractionDigits = options?.maximumFractionDigits ?? defaultMaximumFractionDigits;
  const minimumFractionDigits = Math.min(
    options?.minimumFractionDigits ?? (options?.maximumFractionDigits === 0 ? 0 : defaultMinimumFractionDigits),
    maximumFractionDigits,
  );
  const number = new Intl.NumberFormat(locale === 'ar' ? 'en-US' : intlTagFor(locale), {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: options?.useGrouping,
  });
  const symbol = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0).find((part) => part.type === 'currency')?.value || currency;

  return {
    format: (value: number) => ltrIsolate(`${number.format(value)} ${symbol}`),
    formatToParts: (value: number) => [
      ...number.formatToParts(value),
      { type: 'literal' as const, value: ' ' },
      { type: 'currency' as const, value: symbol },
    ],
  };
};
