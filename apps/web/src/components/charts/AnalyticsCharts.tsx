'use client';

export { RevenueTrendChart } from './RevenueTrendChart';
export type { RevenueTrendPoint, RevenueTrendChartProps } from './RevenueTrendChart';

export { IncomeExpenseBarChart } from './IncomeExpenseBarChart';
export type { IncomeExpenseRow, IncomeExpenseBarChartProps } from './IncomeExpenseBarChart';

export { TopClientsBarChart } from './TopClientsBarChart';
export type { ClientRevenueItem, TopClientsBarChartProps } from './TopClientsBarChart';

export { ExpenseCategoryBarChart } from './ExpenseCategoryBarChart';
export type { CategoryExpenseItem, ExpenseCategoryBarChartProps } from './ExpenseCategoryBarChart';

// Backwards-compatibility aliases
export { IncomeExpenseBarChart as AnalyticsRevenueExpensesChart } from './IncomeExpenseBarChart';
export { ExpenseCategoryBarChart as AnalyticsCategoryBarChart } from './ExpenseCategoryBarChart';
