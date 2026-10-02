import { CurrencyCode } from '../types/finance';
import { createCurrencyFormatter, type NumberFormatOptions } from './format';
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
  createCurrencyFormatter(currency, locale, options)
);

// Unicode bidi isolates. Digits and currency symbols are direction-neutral, so an amount's visual
// order otherwise depends on the paragraph it lands in. English reads "$1,200.00"; Arabic reads the
// number first and then the symbol, so on screen the symbol sits to the LEFT: "$ 1,200.00".
const RLI = '⁧';
const LRI = '⁦';
const PDI = '⁩';

const symbolFor = (currency: CurrencyCode) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  currencyDisplay: 'narrowSymbol',
}).formatToParts(0).find((part) => part.type === 'currency')?.value || currency;

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

const makeSymbolCurrencyFormatter = (currency: CurrencyCode, options: NumberFormatOptions | undefined, locale: Locale) => {
  // Latin digits in en-US grouping so amounts look the same in Arabic and English mode.
  const number = new Intl.NumberFormat('en-US', {
    ...fractionDigitsFor(currency, options),
    useGrouping: options?.useGrouping,
  });
  const symbol = symbolFor(currency);
  const format = (value: number) => {
    const magnitude = number.format(Math.abs(value));
    const sign = value < 0 ? '-' : '';
    if (locale === 'ar') return `${RLI}${LRI}${sign}${magnitude}${PDI} ${symbol}${PDI}`;
    return `${sign}${symbol}${magnitude}`;
  };
  return {
    format,
    formatToParts: (value: number) => {
      const numberParts = number.formatToParts(value);
      const currencyPart = { type: 'currency' as const, value: symbol };
      return locale === 'ar'
        ? [...numberParts, { type: 'literal' as const, value: ' ' }, currencyPart]
        : [currencyPart, ...numberParts];
    },
  };
};

export const makeLongCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => (
  makeSymbolCurrencyFormatter(currency, options, locale)
);

export const makeCompactCurrencyFormatter = (currency: CurrencyCode, options?: NumberFormatOptions, locale: Locale = DEFAULT_LOCALE) => (
  makeSymbolCurrencyFormatter(currency, options, locale)
);
