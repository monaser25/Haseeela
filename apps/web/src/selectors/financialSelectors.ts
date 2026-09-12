import { Transaction, Client, Subscription } from '@/types/finance';

export const getTotalRevenue = (transactions: Transaction[]) => {
  return transactions
    .filter(tx => tx.type === 'INCOME' && tx.status === 'COMPLETED')
    .reduce((sum, tx) => sum + tx.amount, 0);
};

export const getTotalExpenses = (transactions: Transaction[]) => {
  return transactions
    .filter(tx => tx.type === 'EXPENSE' && tx.status === 'COMPLETED')
    .reduce((sum, tx) => sum + tx.amount, 0);
};

export const getNetProfit = (transactions: Transaction[]) => {
  return getTotalRevenue(transactions) - getTotalExpenses(transactions);
};

export const getMonthlyRevenue = (transactions: Transaction[]) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return transactions
    .filter(tx => {
      const d = new Date(tx.date);
      return tx.type === 'INCOME' && tx.status === 'COMPLETED' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
};

export const getClientRevenue = (transactions: Transaction[], clientId: string) => {
  return transactions
    .filter(tx => tx.type === 'INCOME' && tx.status === 'COMPLETED' && (tx.clientId === clientId || (tx.sourceType === 'client' && tx.sourceId === clientId)))
    .reduce((sum, tx) => sum + tx.amount, 0);
};

export const getRecentTransactions = (transactions: Transaction[], limit = 5) => {
  return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
};

export const getTopClients = (transactions: Transaction[], clients: Client[], limit = 5) => {
  const clientRevenue: Record<string, number> = {};
  
  transactions.forEach(tx => {
    const clientId = tx.clientId || (tx.sourceType === 'client' ? tx.sourceId : undefined);
    if (tx.type === 'INCOME' && clientId) {
      clientRevenue[clientId] = (clientRevenue[clientId] || 0) + tx.amount;
    }
  });

  return clients
    .map(c => ({ client: c, revenue: clientRevenue[c.id] || 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
};

export const getRevenueBreakdown = (transactions: Transaction[]) => {
  const breakdown: Record<string, number> = {};
  transactions.filter(tx => tx.type === 'INCOME').forEach(tx => {
    breakdown[tx.sourceType] = (breakdown[tx.sourceType] || 0) + tx.amount;
  });
  return breakdown;
};

export const getActiveSubscriptionsCount = (subscriptions: Subscription[]) => {
  return subscriptions.filter(s => s.status === 'ACTIVE' && !s.archivedAt).length;
};

export const getSubscriptionBurden = (subscriptions: Subscription[]) => {
  return subscriptions
    .filter(s => s.status === 'ACTIVE' && !s.archivedAt)
    .reduce((sum, subscription) => {
      const cycle = subscription.billingCycle || subscription.cycle;
      if (cycle === 'YEARLY') return sum + subscription.amount / 12;
      if (cycle === 'QUARTERLY') return sum + subscription.amount / 3;
      return sum + subscription.amount;
    }, 0);
};

export const selectPendingPayments = (transactions: Transaction[]) => {
  return [...transactions]
    .filter(tx => tx.type === 'INCOME' && tx.status === 'PENDING')
    .sort((a, b) => {
      const dateA = new Date(a.expectedDate || a.date).getTime();
      const dateB = new Date(b.expectedDate || b.date).getTime();
      return dateA - dateB;
    });
};

export const selectPendingTotal = (transactions: Transaction[]) => {
  return selectPendingPayments(transactions).reduce((sum, tx) => sum + tx.amount, 0);
};

export const selectPendingCount = (transactions: Transaction[]) => {
  return selectPendingPayments(transactions).length;
};

const toDateKey = (val: Date | string) => {
  if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
  const date = val instanceof Date ? val : new Date(val);
  return date.toISOString().slice(0, 10);
};

export const daysOverdue = (transaction: Transaction, today: Date | string = new Date()) => {
  const rawDate = transaction.expectedDate || transaction.date;
  if (!rawDate) return 0;
  const expKey = toDateKey(rawDate);
  const todayKey = toDateKey(today);
  const expMs = Date.parse(`${expKey}T00:00:00.000Z`);
  const todayMs = Date.parse(`${todayKey}T00:00:00.000Z`);
  if (Number.isNaN(expMs) || Number.isNaN(todayMs)) return 0;
  const diffDays = Math.floor((todayMs - expMs) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export const selectOverduePendingCount = (transactions: Transaction[], today: Date | string = new Date()) => {
  return selectPendingPayments(transactions).filter((tx) => daysOverdue(tx, today) > 0).length;
};

export const getOverviewStats = (transactions: Transaction[], clients: Client[], subscriptions: Subscription[]) => {
  const totalRevenue = getTotalRevenue(transactions);
  const totalExpenses = getTotalExpenses(transactions);

  return {
    totalRevenue,
    monthlyRevenue: getMonthlyRevenue(transactions),
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    activeSubscriptionsCount: getActiveSubscriptionsCount(subscriptions),
    subscriptionBurden: getSubscriptionBurden(subscriptions),
    totalClients: clients.filter((client) => !client.archivedAt).length,
    activeClients: clients.filter((client) => client.status === 'ACTIVE' && !client.archivedAt).length,
    pendingTotal: selectPendingTotal(transactions),
    pendingCount: selectPendingCount(transactions),
  };
};
