import {
  getClientRevenue,
  getTotalRevenue,
  getMonthlyRevenue,
  getNetProfit,
  selectPendingPayments,
  selectPendingTotal,
  selectPendingCount,
  selectOverduePendingCount,
  daysOverdue,
  daysUntilDate,
  getOverviewStats,
} from './financialSelectors';
import { Transaction } from '@/types/finance';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  name: 'Client payment',
  amount: 100,
  type: 'INCOME',
  status: 'COMPLETED',
  date: '2026-05-01T12:00:00.000Z',
  sourceType: 'client',
  sourceId: 'client-1',
  sourceBillingDate: '2026-05-01T12:00:00.000Z',
  categoryId: 'CLIENT',
  ...overrides,
});

describe('financial selectors', () => {
  it('calculates client payment history from clientId and source links', () => {
    expect(getClientRevenue([
      transaction({ id: 'tx-client-id', clientId: 'client-1', amount: 100 }),
      transaction({ id: 'tx-source-id', clientId: undefined, sourceId: 'client-1', amount: 200 }),
      transaction({ id: 'tx-other', clientId: 'client-2', sourceId: 'client-2', amount: 999 }),
    ], 'client-1')).toBe(300);
  });

  it('excludes a PENDING income transaction from total revenue, monthly revenue, and net profit', () => {
    const today = new Date();
    const currentMonthIso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 15, 12)).toISOString();

    const transactions = [
      transaction({ id: 'tx-completed', amount: 500, status: 'COMPLETED', type: 'INCOME', date: currentMonthIso }),
      transaction({ id: 'tx-pending', amount: 300, status: 'PENDING', type: 'INCOME', date: currentMonthIso }),
      transaction({ id: 'tx-expense', amount: 100, status: 'COMPLETED', type: 'EXPENSE', date: currentMonthIso }),
    ];

    expect(getTotalRevenue(transactions)).toBe(500);
    expect(getMonthlyRevenue(transactions)).toBe(500);
    expect(getNetProfit(transactions)).toBe(400);
  });

  it('sums and counts only pending income with selectPendingTotal and selectPendingCount', () => {
    const transactions = [
      transaction({ id: 'tx-p1', amount: 200, status: 'PENDING', type: 'INCOME', expectedDate: '2026-05-01' }),
      transaction({ id: 'tx-p2', amount: 350, status: 'PENDING', type: 'INCOME', expectedDate: '2026-05-10' }),
      transaction({ id: 'tx-completed', amount: 1000, status: 'COMPLETED', type: 'INCOME' }),
      transaction({ id: 'tx-pending-expense', amount: 50, status: 'PENDING', type: 'EXPENSE' }),
    ];

    expect(selectPendingTotal(transactions)).toBe(550);
    expect(selectPendingCount(transactions)).toBe(2);

    const sorted = selectPendingPayments(transactions);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].id).toBe('tx-p1');
    expect(sorted[1].id).toBe('tx-p2');
  });

  it('handles past date, today, and future date for selectOverduePendingCount and daysOverdue', () => {
    const today = new Date('2026-06-15T12:00:00.000Z');

    const pastTx = transaction({ id: 'tx-past', amount: 100, status: 'PENDING', type: 'INCOME', expectedDate: '2026-06-10T12:00:00.000Z' });
    const todayTx = transaction({ id: 'tx-today', amount: 100, status: 'PENDING', type: 'INCOME', expectedDate: '2026-06-15T12:00:00.000Z' });
    const futureTx = transaction({ id: 'tx-future', amount: 100, status: 'PENDING', type: 'INCOME', expectedDate: '2026-06-20T12:00:00.000Z' });

    expect(daysOverdue(pastTx, today)).toBe(5);
    expect(daysOverdue(todayTx, today)).toBe(0);
    expect(daysOverdue(futureTx, today)).toBe(0);

    const transactions = [pastTx, todayTx, futureTx];
    expect(selectOverduePendingCount(transactions, today)).toBe(1);
  });

  it('calculates UTC calendar days until a target date with daysUntilDate', () => {
    const today = new Date('2026-06-15T12:00:00.000Z');

    expect(daysUntilDate('2026-06-10T12:00:00.000Z', today)).toBe(-5);
    expect(daysUntilDate('2026-06-15T00:00:00.000Z', today)).toBe(0);
    expect(daysUntilDate('2026-06-16', today)).toBe(1);
    expect(daysUntilDate('2026-06-18', today)).toBe(3);
    expect(daysUntilDate('2026-06-25', today)).toBe(10);
    expect(daysUntilDate('2026-06-29', today)).toBe(14);
    expect(daysUntilDate('2026-06-30', today)).toBe(15);
    expect(daysUntilDate(null, today)).toBeNull();
    expect(daysUntilDate(undefined, today)).toBeNull();
  });

  it('includes a pending row in total revenue after it flips to COMPLETED', () => {
    const tx = transaction({ id: 'tx-1', amount: 450, status: 'PENDING', type: 'INCOME' });

    expect(getTotalRevenue([tx])).toBe(0);

    const completedTx: Transaction = { ...tx, status: 'COMPLETED', completedAt: new Date().toISOString() };
    expect(getTotalRevenue([completedTx])).toBe(450);
  });

  it('populates pendingTotal and pendingCount in getOverviewStats', () => {
    const transactions = [
      transaction({ id: 'tx-1', amount: 300, status: 'PENDING', type: 'INCOME' }),
      transaction({ id: 'tx-2', amount: 200, status: 'PENDING', type: 'INCOME' }),
      transaction({ id: 'tx-3', amount: 1000, status: 'COMPLETED', type: 'INCOME' }),
    ];

    const stats = getOverviewStats(transactions, [], []);
    expect(stats.pendingTotal).toBe(500);
    expect(stats.pendingCount).toBe(2);
    expect(stats.totalRevenue).toBe(1000);
  });
});
