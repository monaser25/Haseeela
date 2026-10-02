/**
 * Notification routing, date grouping, and time formatting helpers.
 */

/**
 * Strict allowlist for notification server links.
 * Maps known relative server routes to mobile Expo Router destinations.
 * Disallows arbitrary external, protocol-relative, javascript:, or unknown links.
 */
export function resolveNotificationRoute(link?: string | null): string | null {
  if (!link || typeof link !== 'string') {
    return null;
  }

  const trimmed = link.trim();

  // Disallow scheme, protocol-relative, javascript, or external urls
  if (
    trimmed.startsWith('//') ||
    trimmed.includes('://') ||
    /^(javascript|data|file):/i.test(trimmed)
  ) {
    return null;
  }

  // Exact allowlist routes
  if (trimmed === '/subscriptions') {
    return '/(app)/subscriptions';
  }

  if (trimmed === '/clients') {
    return '/(app)/(tabs)/clients';
  }

  if (trimmed === '/invoices') {
    return '/(app)/invoices';
  }

  // Invoices by safe ID: must match alphanumeric, hyphen, underscore
  const invoiceMatch = trimmed.match(/^\/invoices\/([a-zA-Z0-9_-]+)$/);
  if (invoiceMatch) {
    const safeId = invoiceMatch[1];
    return `/(app)/invoice/${encodeURIComponent(safeId)}`;
  }

  return null;
}

export type NotificationDateGroup = 'today' | 'yesterday' | 'earlier';

/**
 * Groups a notification ISO string into 'today', 'yesterday', or 'earlier'
 * using local calendar boundaries to prevent UTC shifts and DST discrepancies.
 */
export function groupNotificationDate(
  dateStr?: string | null,
  referenceDate: Date = new Date()
): NotificationDateGroup {
  if (!dateStr || typeof dateStr !== 'string') {
    return 'earlier';
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return 'earlier';
  }

  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  const startOfYesterday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 1
  ).getTime();

  const startOfNotif = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();

  if (startOfNotif >= startOfToday) {
    return 'today';
  }
  if (startOfNotif >= startOfYesterday) {
    return 'yesterday';
  }
  return 'earlier';
}

/**
 * Formats notification relative time using shared message keys.
 * Safely handles invalid or future dates.
 */
export function formatNotificationTime(
  dateStr: string | null | undefined,
  t: (key: any, params?: any) => string,
  referenceTime: number = Date.now()
): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';

  const diffMs = referenceTime - time;
  if (diffMs < 60_000) {
    return t('notifications.time.justNow');
  }

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return t('notifications.time.minsAgo', { mins });
  }

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return t('notifications.time.hrsAgo', { hrs });
  }

  const days = Math.floor(hrs / 24);
  return t('notifications.time.daysAgo', { days });
}
