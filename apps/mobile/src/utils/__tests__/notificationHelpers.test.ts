import {
  resolveNotificationRoute,
  groupNotificationDate,
  formatNotificationTime,
} from '../notificationHelpers';

describe('notificationHelpers', () => {
  describe('resolveNotificationRoute allowlist', () => {
    it('resolves valid allowlisted routes to native destinations', () => {
      expect(resolveNotificationRoute('/subscriptions')).toBe('/(app)/subscriptions');
      expect(resolveNotificationRoute('/clients')).toBe('/(app)/(tabs)/clients');
      expect(resolveNotificationRoute('/invoices')).toBe('/(app)/invoices');
      expect(resolveNotificationRoute('/invoices/inv-123_abc')).toBe('/(app)/invoice/inv-123_abc');
    });

    it('rejects unknown, external, protocol-relative, and dangerous links', () => {
      expect(resolveNotificationRoute(null)).toBeNull();
      expect(resolveNotificationRoute(undefined)).toBeNull();
      expect(resolveNotificationRoute('')).toBeNull();
      expect(resolveNotificationRoute('https://evil.com')).toBeNull();
      expect(resolveNotificationRoute('http://evil.com')).toBeNull();
      expect(resolveNotificationRoute('//evil.com/subscriptions')).toBeNull();
      expect(resolveNotificationRoute('javascript:alert(1)')).toBeNull();
      expect(resolveNotificationRoute('/unknown-path')).toBeNull();
      expect(resolveNotificationRoute('/invoices/../../secret')).toBeNull();
      expect(resolveNotificationRoute('/invoices/inv 123/evil')).toBeNull();
      expect(resolveNotificationRoute('/settings')).toBeNull();
    });
  });

  describe('groupNotificationDate', () => {
    const reference = new Date(2026, 4, 15, 14, 0, 0); // May 15, 2026, 2:00 PM local

    it('groups dates into today, yesterday, and earlier using local calendar', () => {
      const todayDate = new Date(2026, 4, 15, 8, 30, 0).toISOString();
      const yesterdayDate = new Date(2026, 4, 14, 23, 45, 0).toISOString();
      const earlierDate = new Date(2026, 4, 10, 10, 0, 0).toISOString();

      expect(groupNotificationDate(todayDate, reference)).toBe('today');
      expect(groupNotificationDate(yesterdayDate, reference)).toBe('yesterday');
      expect(groupNotificationDate(earlierDate, reference)).toBe('earlier');
    });

    it('falls back safely to earlier on invalid or empty date without throwing', () => {
      expect(groupNotificationDate(null, reference)).toBe('earlier');
      expect(groupNotificationDate('invalid-date', reference)).toBe('earlier');
    });
  });

  describe('formatNotificationTime', () => {
    const mockT = (key: string, params?: Record<string, any>) => {
      if (params?.mins !== undefined) return `${params.mins}m ago`;
      if (params?.hrs !== undefined) return `${params.hrs}h ago`;
      if (params?.days !== undefined) return `${params.days}d ago`;
      if (key === 'notifications.time.justNow') return 'Just now';
      return key;
    };

    const ref = new Date('2026-05-15T12:00:00.000Z').getTime();

    it('formats just now for < 1 min', () => {
      const date = new Date(ref - 30_000).toISOString();
      expect(formatNotificationTime(date, mockT, ref)).toBe('Just now');
    });

    it('formats mins for < 1 hour', () => {
      const date = new Date(ref - 15 * 60_000).toISOString();
      expect(formatNotificationTime(date, mockT, ref)).toBe('15m ago');
    });

    it('formats hours for < 24 hours', () => {
      const date = new Date(ref - 4 * 3600_000).toISOString();
      expect(formatNotificationTime(date, mockT, ref)).toBe('4h ago');
    });

    it('formats days for >= 24 hours', () => {
      const date = new Date(ref - 3 * 86400_000).toISOString();
      expect(formatNotificationTime(date, mockT, ref)).toBe('3d ago');
    });

    it('returns empty string for invalid date', () => {
      expect(formatNotificationTime('not-a-date', mockT, ref)).toBe('');
      expect(formatNotificationTime(null, mockT, ref)).toBe('');
    });
  });
});
