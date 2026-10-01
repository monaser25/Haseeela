import { translate, createTranslator } from '../translate';
import { en, ar, MessageKey } from '@haseela/shared';

describe('i18n translate function', () => {
  describe('English lookups', () => {
    it('translates brand.name correctly in English', () => {
      const result = translate('en', 'brand.name');
      expect(result).toBe(en['brand.name']);
      expect(result).toBe('Haseeela');
    });

    it('translates common UI keys in English', () => {
      expect(translate('en', 'topbar.copy.overview.title')).toBe('Overview');
      expect(translate('en', 'transactions.title')).toBe('Transactions');
    });
  });

  describe('Arabic lookups', () => {
    it('translates brand.name correctly in Arabic', () => {
      const result = translate('ar', 'brand.name');
      expect(result).toBe(ar['brand.name']);
      expect(result).toBe('حصيــــلة');
    });

    it('translates common UI keys in Arabic', () => {
      expect(translate('ar', 'topbar.copy.overview.title')).toBe('نظرة عامة');
      expect(translate('ar', 'transactions.title')).toBe('المعاملات');
    });
  });

  describe('Interpolation', () => {
    it('interpolates single variable placeholder', () => {
      // 'onboarding.welcome.title': 'Welcome, {name}!'
      const result = translate('en', 'onboarding.welcome.title', { name: 'Sarah' });
      expect(result).toBe('Welcome, Sarah!');
    });

    it('interpolates multiple variable placeholders', () => {
      // 'analytics.clients.subtitle': '{clients} clients · {amount} total'
      const result = translate('en', 'analytics.clients.subtitle', {
        clients: 5,
        amount: '$10,000',
      });
      expect(result).toBe('5 clients · $10,000 total');
    });

    it('leaves unsupplied placeholders unchanged or safely handles missing vars', () => {
      const result = translate('en', 'onboarding.welcome.title');
      expect(result).toBe('Welcome, {name}!');
    });

    it('handles numeric 0 correctly in interpolation', () => {
      const result = translate('en', 'analytics.categories.subtitle', { count: 0 });
      expect(result).toBe('0 categories');
    });
  });

  describe('Fallback behavior', () => {
    it('falls back to English when key is missing in Arabic dictionary', () => {
      // Mock an unknown key that exists only in English
      const fakeEnKey = 'fake.test.key' as MessageKey;
      (en as Record<string, string>)[fakeEnKey] = 'English Only Value';

      const result = translate('ar', fakeEnKey);
      expect(result).toBe('English Only Value');

      delete (en as Record<string, string>)[fakeEnKey];
    });

    it('returns the raw key when missing in both Arabic and English dictionaries', () => {
      const missingKey = 'completely.nonexistent.key' as MessageKey;
      const result = translate('ar', missingKey);
      expect(result).toBe('completely.nonexistent.key');
    });
  });

  describe('createTranslator helper', () => {
    it('creates a translator bound to English by default', () => {
      const t = createTranslator();
      expect(t('brand.name')).toBe('Haseeela');
    });

    it('creates a translator bound to Arabic', () => {
      const t = createTranslator('ar');
      expect(t('brand.name')).toBe('حصيــــلة');
    });
  });
});
