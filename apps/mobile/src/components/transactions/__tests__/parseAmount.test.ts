import { parseLocaleAmount } from '../parseAmount';

describe('parseLocaleAmount', () => {
  describe('valid decimal inputs', () => {
    it('parses Arabic-Indic digits with Arabic decimal separator (\u0661\u0662\u066B\u0665 -> 12.5)', () => {
      expect(parseLocaleAmount('\u0661\u0662\u066B\u0665')).toBe(12.5);
      expect(parseLocaleAmount('\u0660\u066B\u0665')).toBe(0.5);
      expect(parseLocaleAmount('\u0661\u0660\u0660\u066B\u0662\u0665')).toBe(100.25);
    });

    it('parses decimal comma (12,5 -> 12.5)', () => {
      expect(parseLocaleAmount('12,5')).toBe(12.5);
      expect(parseLocaleAmount('0,5')).toBe(0.5);
      expect(parseLocaleAmount('1200,99')).toBe(1200.99);
      expect(parseLocaleAmount(',75')).toBe(0.75);
    });

    it('parses valid ordinary decimals and integers', () => {
      expect(parseLocaleAmount('12.5')).toBe(12.5);
      expect(parseLocaleAmount('0.99')).toBe(0.99);
      expect(parseLocaleAmount('100')).toBe(100);
      expect(parseLocaleAmount('100.00')).toBe(100);
      expect(parseLocaleAmount('.5')).toBe(0.5);
      expect(parseLocaleAmount('42.')).toBe(42);
      expect(parseLocaleAmount('+12.5')).toBe(12.5);
    });

    it('parses Arabic-Indic and Persian integers', () => {
      expect(parseLocaleAmount('\u0661\u0662\u0663')).toBe(123);
      expect(parseLocaleAmount('\u0665\u0660\u0660\u0660')).toBe(5000);
      expect(parseLocaleAmount('\u06F1\u06F2\u06F3')).toBe(123);
    });
  });

  describe('grouping inputs are rejected (strict decimal-only contract)', () => {
    it('rejects thousands grouping with decimals or integers (1,000.50, 1.000,50, 1,000,000, etc.)', () => {
      // US standard grouping
      expect(parseLocaleAmount('1,000.50')).toBeNaN();
      expect(parseLocaleAmount('1,234,567.89')).toBeNaN();

      // EU standard grouping
      expect(parseLocaleAmount('1.000,50')).toBeNaN();
      expect(parseLocaleAmount('1.234.567,89')).toBeNaN();

      // Arabic grouping '\u066C' with Arabic decimal '\u066B'
      expect(parseLocaleAmount('\u0661\u066C\u0660\u0660\u0660\u066B\u0665\u0660')).toBeNaN();

      // Pure thousands grouping without decimals
      expect(parseLocaleAmount('1,000,000')).toBeNaN();
      expect(parseLocaleAmount('1.000.000')).toBeNaN();
    });
  });

  describe('empty and whitespace inputs', () => {
    it('returns NaN for empty or whitespace-only strings', () => {
      expect(parseLocaleAmount('')).toBeNaN();
      expect(parseLocaleAmount('   ')).toBeNaN();
      expect(parseLocaleAmount(null as unknown as string)).toBeNaN();
      expect(parseLocaleAmount(undefined as unknown as string)).toBeNaN();
    });
  });

  describe('malformed and ambiguous inputs', () => {
    it('rejects strings containing letters or alphanumeric prefixes/suffixes (12abc)', () => {
      expect(parseLocaleAmount('12abc')).toBeNaN();
      expect(parseLocaleAmount('abc12')).toBeNaN();
      expect(parseLocaleAmount('12a.5')).toBeNaN();
      expect(parseLocaleAmount('$12.50')).toBeNaN();
      expect(parseLocaleAmount('12 USD')).toBeNaN();
    });

    it('rejects multiple invalid decimals (1.2.3, 1,2,3)', () => {
      expect(parseLocaleAmount('1.2.3')).toBeNaN();
      expect(parseLocaleAmount('1,2,3')).toBeNaN();
      expect(parseLocaleAmount('1.2.3.4')).toBeNaN();
      expect(parseLocaleAmount('1,2.3')).toBeNaN();
      expect(parseLocaleAmount('1.2,3')).toBeNaN();
      expect(parseLocaleAmount('\u0661\u066B\u0662\u066B\u0663')).toBeNaN();
    });

    it('rejects malformed grouping', () => {
      expect(parseLocaleAmount('12,34.50')).toBeNaN();
      expect(parseLocaleAmount('1,2,300.50')).toBeNaN();
      expect(parseLocaleAmount('1.2.300,50')).toBeNaN();
      expect(parseLocaleAmount('1.23,456')).toBeNaN();
    });

    it('rejects strings with no digits or multiple signs', () => {
      expect(parseLocaleAmount('.')).toBeNaN();
      expect(parseLocaleAmount(',')).toBeNaN();
      expect(parseLocaleAmount('-')).toBeNaN();
      expect(parseLocaleAmount('+')).toBeNaN();
      expect(parseLocaleAmount('--12')).toBeNaN();
      expect(parseLocaleAmount('12-5')).toBeNaN();
      expect(parseLocaleAmount('+-12')).toBeNaN();
    });
  });

  describe('negatives, zero, and non-finite inputs', () => {
    it('parses negative numbers correctly', () => {
      expect(parseLocaleAmount('-12.5')).toBe(-12.5);
      expect(parseLocaleAmount('-12,5')).toBe(-12.5);
      expect(parseLocaleAmount('-\u0661\u0662\u066B\u0665')).toBe(-12.5);
      expect(parseLocaleAmount('-100')).toBe(-100);
    });

    it('parses zero correctly', () => {
      expect(parseLocaleAmount('0')).toBe(0);
      expect(parseLocaleAmount('0.00')).toBe(0);
      expect(parseLocaleAmount('\u0660')).toBe(0);
    });

    it('returns NaN for non-finite inputs', () => {
      expect(parseLocaleAmount('Infinity')).toBeNaN();
      expect(parseLocaleAmount('-Infinity')).toBeNaN();
      expect(parseLocaleAmount('NaN')).toBeNaN();
    });
  });
});
