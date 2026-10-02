import { CurrencyCode } from '../types/finance';
import { currencySymbol, formatCurrency, type NumberFormatOptions } from './format';
import { DEFAULT_LOCALE, type Locale } from './locales';

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
  makeSymbolCurrencyFormatter(currency, options, locale)
);

const fractionDigitsFor = (currency: CurrencyCode, options?: NumberFormatOptions) => {
  const currencyDefaults = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions();
  const defaultMax = currencyDefaults.maximumFractionDigits ?? 2;
  const defaultMin = currencyDefaults.minimumFractionDigits ?? defaultMax;
  const maximumFractionDigits = options?.maximumFractionDigits ?? defaultMax;
  const minimumFractionDigits = Math.min(
    options?.minimumFractionDigits ?? (options?.maximumFractionDigits === 0 ? 0 : defaultMin),
    maximumFractionDigits,
  );
  return { minimumFractionDigits, maximumFractionDigits };
};

// Every currency formatter renders like formatCurrency: number then symbol, "1,200.00 $".
const makeSymbolCurrencyFormatter = (currency: CurrencyCode, options: NumberFormatOptions | undefined, locale: Locale) => {
  const resolved = { ...options, ...fractionDigitsFor(currency, options) };
  const number = new Intl.NumberFormat('en-US', resolved);
  const symbol = currencySymbol(currency);
  return {
    format: (value: number) => formatCurrency(value, currency, locale, resolved),
    formatToParts: (value: number) => [
      ...number.formatToParts(value),
      { type: 'literal' as const, value: ' ' },
      { type: 'currency' as const, value: symbol },
    ],
  };
};

export const makeLongCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => (
  makeSymbolCurrencyFormatter(currency, options, locale)
);

export const makeCompactCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => (
  makeSymbolCurrencyFormatter(currency, options, locale)
);
