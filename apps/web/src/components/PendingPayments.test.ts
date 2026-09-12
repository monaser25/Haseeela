import { daysOverdue, selectPendingPayments } from '@/selectors/financialSelectors';
import { Transaction } from '@/types/finance';

const makeTx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  name: 'Test payment',
  amount: 500,
  type: 'INCOME',
  status: 'PENDING',
  date: '2026-06-01T12:00:00.000Z',
  expectedDate: '2026-06-01',
  categoryId: 'CLIENT',
  sourceType: 'client',
  ...overrides,
});

// Sort logic used in PendingPaymentsSection
function sortPendingPayments(payments: Transaction[], today = new Date('2026-06-15T12:00:00.000Z')) {
  return [...payments].sort((a, b) => {
    const overdueA = daysOverdue(a, today);
    const overdueB = daysOverdue(b, today);
    const isOverdueA = overdueA > 0;
    const isOverdueB = overdueB > 0;

    if (isOverdueA && isOverdueB) {
      if (overdueB !== overdueA) return overdueB - overdueA;
      const timeA = new Date(a.expectedDate || a.date).getTime();
      const timeB = new Date(b.expectedDate || b.date).getTime();
      return timeA - timeB;
    }
    if (isOverdueA && !isOverdueB) return -1;
    if (!isOverdueA && isOverdueB) return 1;

    const timeA = new Date(a.expectedDate || a.date).getTime();
    const timeB = new Date(b.expectedDate || b.date).getTime();
    return timeA - timeB;
  });
}

function getOverdueBadgeTone(days: number): 'warning' | 'negative' {
  return days > 14 ? 'negative' : 'warning';
}

describe('PendingPayments UI logic', () => {
  const referenceDate = new Date('2026-06-15T12:00:00.000Z');

  describe('Sorting: overdue first (most overdue at top), then expected date ascending', () => {
    it('sorts overdue payments ahead of non-overdue payments', () => {
      const p1 = makeTx({ id: 'p1-future', expectedDate: '2026-06-20' }); // not overdue
      const p2 = makeTx({ id: 'p2-overdue', expectedDate: '2026-06-10' }); // 5 days overdue

      const sorted = sortPendingPayments([p1, p2], referenceDate);
      expect(sorted.map((p) => p.id)).toEqual(['p2-overdue', 'p1-future']);
    });

    it('sorts most overdue payments at the top', () => {
      const p1 = makeTx({ id: 'p1-mildly-overdue', expectedDate: '2026-06-12' }); // 3 days overdue
      const p2 = makeTx({ id: 'p2-very-overdue', expectedDate: '2026-05-25' }); // 21 days overdue
      const p3 = makeTx({ id: 'p3-moderately-overdue', expectedDate: '2026-06-05' }); // 10 days overdue

      const sorted = sortPendingPayments([p1, p2, p3], referenceDate);
      expect(sorted.map((p) => p.id)).toEqual([
        'p2-very-overdue',
        'p3-moderately-overdue',
        'p1-mildly-overdue',
      ]);
    });

    it('sorts non-overdue payments by expected date ascending', () => {
      const p1 = makeTx({ id: 'p1-later', expectedDate: '2026-06-30' });
      const p2 = makeTx({ id: 'p2-sooner', expectedDate: '2026-06-18' });
      const p3 = makeTx({ id: 'p3-today', expectedDate: '2026-06-15' }); // 0 days overdue

      const sorted = sortPendingPayments([p1, p2, p3], referenceDate);
      expect(sorted.map((p) => p.id)).toEqual(['p3-today', 'p2-sooner', 'p1-later']);
    });

    it('handles mixed list correctly', () => {
      const p1 = makeTx({ id: 'p1-future', expectedDate: '2026-07-01' });
      const p2 = makeTx({ id: 'p2-overdue-5', expectedDate: '2026-06-10' }); // 5 days
      const p3 = makeTx({ id: 'p3-overdue-20', expectedDate: '2026-05-26' }); // 20 days
      const p4 = makeTx({ id: 'p4-soon', expectedDate: '2026-06-16' });

      const sorted = sortPendingPayments([p1, p2, p3, p4], referenceDate);
      expect(sorted.map((p) => p.id)).toEqual([
        'p3-overdue-20',
        'p2-overdue-5',
        'p4-soon',
        'p1-future',
      ]);
    });
  });

  describe('Overdue badge tone threshold', () => {
    it('uses warning tone for 1 to 14 days overdue', () => {
      expect(getOverdueBadgeTone(1)).toBe('warning');
      expect(getOverdueBadgeTone(7)).toBe('warning');
      expect(getOverdueBadgeTone(14)).toBe('warning');
    });

    it('uses negative tone past 14 days overdue', () => {
      expect(getOverdueBadgeTone(15)).toBe('negative');
      expect(getOverdueBadgeTone(30)).toBe('negative');
    });
  });

  describe('Client payment history formatting logic', () => {
    it('identifies completed transactions that originated as pending', () => {
      const txOriginatedPending = makeTx({
        id: 'tx-done',
        status: 'COMPLETED',
        expectedDate: '2026-06-01',
        date: '2026-06-05T12:00:00.000Z',
      });
      const txNormal = makeTx({
        id: 'tx-regular',
        status: 'COMPLETED',
        expectedDate: undefined,
        date: '2026-06-05T12:00:00.000Z',
      });

      const isFromPending1 = !!(txOriginatedPending.expectedDate && txOriginatedPending.status === 'COMPLETED');
      const isFromPending2 = !!(txNormal.expectedDate && txNormal.status === 'COMPLETED');

      expect(isFromPending1).toBe(true);
      expect(isFromPending2).toBe(false);

      // Check whether dates differ
      const datesDiffer = isFromPending1 && txOriginatedPending.expectedDate?.slice(0, 10) !== txOriginatedPending.date.slice(0, 10);
      expect(datesDiffer).toBe(true);
    });
  });
});
