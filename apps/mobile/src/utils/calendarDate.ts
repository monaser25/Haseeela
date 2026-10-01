/**
 * Calendar-date helpers for mobile forms and date pickers.
 *
 * Prevents calendar day shifts caused by `toISOString().slice(0, 10)` in UTC+ offsets
 * and UTC-midnight parsing in UTC- offsets.
 */

/**
 * Serializes a Date into 'YYYY-MM-DD' using local calendar values.
 * Does not convert through UTC / toISOString, preserving the picked calendar day.
 */
export function formatCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a 'YYYY-MM-DD' (or ISO date string) into a local Date set to noon (12:00:00).
 * Setting to local noon guarantees that:
 * 1. `date.getFullYear()`, `date.getMonth()`, and `date.getDate()` match the calendar day in any timezone.
 * 2. DST transitions (which occur at midnight or 2 AM) never shift the calendar day.
 */
export function parseCalendarDate(dateStr?: string | null): Date {
  if (!dateStr) return new Date();

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Normalizes a Date to local noon of the same calendar day.
 */
export function normalizeCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
}
