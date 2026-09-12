'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFinancialStore } from '@/store/useFinancialStore';
import { selectPendingCount, selectPendingTotal } from '@/selectors/financialSelectors';
import { Transaction } from '@/types/finance';
import { makeCompactCurrencyFormatter, makeLongCurrencyFormatter } from '@/lib/currency';
import { useLocale } from '@/lib/i18n';
import { useCountUp } from '@/lib/useReducedMotion';
import { Card, SectionHeader } from '@/components/ui/Card';
import { DeltaChip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Form';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { exportAnalyticsToCsv } from '@/lib/analyticsExport';

// Dynamic chart imports with explicit pixel-height loading placeholders
const RevenueTrendChart = dynamic(
  () => import('@/components/charts/RevenueTrendChart').then((mod) => mod.RevenueTrendChart),
  { ssr: false, loading: () => <div className="h-[280px] w-full mt-2" /> },
);

const IncomeExpenseBarChart = dynamic(
  () => import('@/components/charts/IncomeExpenseBarChart').then((mod) => mod.IncomeExpenseBarChart),
  { ssr: false, loading: () => <div className="h-[280px] w-full mt-2" /> },
);

const TopClientsBarChart = dynamic(
  () => import('@/components/charts/TopClientsBarChart').then((mod) => mod.TopClientsBarChart),
  { ssr: false, loading: () => <div className="h-[240px] w-full mt-2" /> },
);

const ExpenseCategoryBarChart = dynamic(
  () => import('@/components/charts/ExpenseCategoryBarChart').then((mod) => mod.ExpenseCategoryBarChart),
  { ssr: false, loading: () => <div className="h-[240px] w-full mt-2" /> },
);

export type Period =
  | { kind: 'month' | 'quarter' | 'year' }
  | { kind: 'custom'; start: string; end: string };

const STORAGE_KEY = 'flowledger_analytics_period';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getPeriodRange(period: Period): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period.kind === 'month') {
    const start = new Date(y, m, 1, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    const prevStart = new Date(y, m - 1, 1, 0, 0, 0);
    const prevEnd = new Date(y, m, 0, 23, 59, 59);
    return { start, end, prevStart, prevEnd };
  }

  if (period.kind === 'quarter') {
    const q = Math.floor(m / 3);
    const start = new Date(y, q * 3, 1, 0, 0, 0);
    const end = new Date(y, q * 3 + 3, 0, 23, 59, 59);
    const prevStart = new Date(y, (q - 1) * 3, 1, 0, 0, 0);
    const prevEnd = new Date(y, q * 3, 0, 23, 59, 59);
    return { start, end, prevStart, prevEnd };
  }

  if (period.kind === 'year') {
    const start = new Date(y, 0, 1, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const prevStart = new Date(y - 1, 0, 1, 0, 0, 0);
    const prevEnd = new Date(y - 1, 11, 31, 23, 59, 59);
    return { start, end, prevStart, prevEnd };
  }

  if (period.kind === 'custom') {
    const start = parseIsoDate(period.start);
    start.setHours(0, 0, 0, 0);
    const end = parseIsoDate(period.end);
    end.setHours(23, 59, 59, 999);

    const durMs = Math.max(end.getTime() - start.getTime(), 0);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durMs);
    return { start, end, prevStart, prevEnd };
  }

  // fallback to month
  const start = new Date(y, m, 1, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59);
  const prevStart = new Date(y, m - 1, 1, 0, 0, 0);
  const prevEnd = new Date(y, m, 0, 23, 59, 59);
  return { start, end, prevStart, prevEnd };
}

function inDateRange(tx: Transaction, start: Date, end: Date) {
  const d = new Date(tx.date);
  return d >= start && d <= end;
}

function computeDeltaPct(curr: number, prev: number): number | undefined {
  if (prev === 0) {
    return curr > 0 ? 100 : undefined;
  }
  return Math.round(((curr - prev) / prev) * 100);
}

export default function AnalyticsPage() {
  const { transactions, clients, overview, currency } = useFinancialStore();
  const { t, locale, dir } = useLocale();

  const money = useMemo(
    () => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale),
    [currency, locale],
  );
  const moneyLong = useMemo(
    () => makeLongCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale),
    [currency, locale],
  );

  // Period state with sessionStorage persistence
  const [period, setPeriod] = useState<Period>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.kind === 'month' || parsed.kind === 'quarter' || parsed.kind === 'year') {
            return { kind: parsed.kind };
          }
          if (parsed.kind === 'custom' && parsed.start && parsed.end) {
            return { kind: 'custom', start: parsed.start, end: parsed.end };
          }
        }
      } catch {
        // ignore
      }
    }
    return { kind: 'month' };
  });

  const updatePeriod = useCallback((next: Period) => {
    setPeriod(next);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  }, []);

  // Custom date range popover state
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIsoDate(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => toIsoDate(new Date()));
  const [customError, setCustomError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCustomOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCustomOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [customOpen]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Date ranges for current period and previous period
  const { start, end, prevStart, prevEnd } = useMemo(() => getPeriodRange(period), [period]);

  const completedTransactions = useMemo(
    () => transactions.filter((tx) => tx.status === 'COMPLETED'),
    [transactions],
  );

  const periodTxs = useMemo(
    () => completedTransactions.filter((tx) => inDateRange(tx, start, end)),
    [completedTransactions, start, end],
  );

  const prevPeriodTxs = useMemo(
    () => completedTransactions.filter((tx) => inDateRange(tx, prevStart, prevEnd)),
    [completedTransactions, prevStart, prevEnd],
  );

  // Current period totals
  const periodRevenue = useMemo(
    () => periodTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
    [periodTxs],
  );
  const periodExpenses = useMemo(
    () => periodTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    [periodTxs],
  );
  const periodProfit = periodRevenue - periodExpenses;

  // Previous period totals for deltas
  const prevRevenue = useMemo(
    () => prevPeriodTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
    [prevPeriodTxs],
  );
  const prevExpenses = useMemo(
    () => prevPeriodTxs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    [prevPeriodTxs],
  );
  const prevProfit = prevRevenue - prevExpenses;

  const revenueDelta = useMemo(() => computeDeltaPct(periodRevenue, prevRevenue), [periodRevenue, prevRevenue]);
  const expensesDelta = useMemo(() => computeDeltaPct(periodExpenses, prevExpenses), [periodExpenses, prevExpenses]);
  const profitDelta = useMemo(() => computeDeltaPct(periodProfit, prevProfit), [periodProfit, prevProfit]);

  // Pending totals from shared selectors (spec §3.1)
  const pendingTotal = useMemo(() => selectPendingTotal(transactions), [transactions]);
  const pendingCount = useMemo(() => selectPendingCount(transactions), [transactions]);

  // Animated KPI numbers with staggered count-up (spec §3.1)
  const animatedRevenue = useCountUp(periodRevenue, 600, 0);
  const animatedProfit = useCountUp(periodProfit, 600, 60);
  const animatedPending = useCountUp(pendingTotal, 600, 120);
  const animatedPendingCount = useCountUp(pendingCount, 600, 120);
  const animatedExpenses = useCountUp(periodExpenses, 600, 180);

  // Period label
  const periodLabel = useMemo(() => {
    if (period.kind === 'month') return t('analytics.periodLabel.month');
    if (period.kind === 'quarter') return t('analytics.periodLabel.quarter');
    if (period.kind === 'year') return t('analytics.periodLabel.year');
    return t('analytics.periodLabel.custom');
  }, [period.kind, t]);

  // Breakdown sub title for grouped bar chart
  const breakdownSub = useMemo(() => {
    if (period.kind === 'month') return t('analytics.chart.weeklyBreakdown');
    if (period.kind === 'quarter') return t('analytics.chart.quarterlyBreakdown');
    if (period.kind === 'year') return t('analytics.chart.monthlyBreakdown');
    return t('analytics.chart.customBreakdown');
  }, [period.kind, t]);

  // §3.2 Hero Revenue Trend: Trailing 12 months rolling, always
  const trailing12Months = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    const points = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(currYear, currMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const rev = completedTransactions
        .filter((tx) => {
          if (tx.type !== 'INCOME') return false;
          const td = new Date(tx.date);
          return td.getFullYear() === y && td.getMonth() === m;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const label = t(`charts.months.${m}` as any);
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      points.push({ key, label, revenue: rev });
    }
    return points;
  }, [completedTransactions, t]);

  // §3.3 Income vs Expenses grouped bar buckets
  const chartBuckets = useMemo(() => {
    const y = start.getFullYear();
    const m = start.getMonth();

    if (period.kind === 'month') {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const buckets: { label: string; startDay: number; endDay: number }[] = [];
      for (let w = 1; w <= daysInMonth; w += 7) {
        buckets.push({
          label: t('analytics.chart.weekLabel', { number: Math.ceil(w / 7) }),
          startDay: w,
          endDay: Math.min(w + 6, daysInMonth),
        });
      }
      return buckets.map(({ label, startDay, endDay }) => {
        const rev = completedTransactions
          .filter((tx) => {
            const d = new Date(tx.date);
            return (
              tx.type === 'INCOME' &&
              d.getFullYear() === y &&
              d.getMonth() === m &&
              d.getDate() >= startDay &&
              d.getDate() <= endDay
            );
          })
          .reduce((s, tx) => s + tx.amount, 0);

        const exp = completedTransactions
          .filter((tx) => {
            const d = new Date(tx.date);
            return (
              tx.type === 'EXPENSE' &&
              d.getFullYear() === y &&
              d.getMonth() === m &&
              d.getDate() >= startDay &&
              d.getDate() <= endDay
            );
          })
          .reduce((s, tx) => s + tx.amount, 0);

        return { label, revenue: rev, expenses: exp };
      });
    }

    if (period.kind === 'quarter') {
      const q = Math.floor(m / 3);
      const months = [q * 3, q * 3 + 1, q * 3 + 2];
      return months.map((mo) => {
        const label = t(`charts.months.${mo}` as any);
        const rev = completedTransactions
          .filter((tx) => {
            const d = new Date(tx.date);
            return tx.type === 'INCOME' && d.getFullYear() === y && d.getMonth() === mo;
          })
          .reduce((s, tx) => s + tx.amount, 0);

        const exp = completedTransactions
          .filter((tx) => {
            const d = new Date(tx.date);
            return tx.type === 'EXPENSE' && d.getFullYear() === y && d.getMonth() === mo;
          })
          .reduce((s, tx) => s + tx.amount, 0);

        return { label, revenue: rev, expenses: exp };
      });
    }

    if (period.kind === 'year') {
      const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      return months.map((mo) => {
        const label = t(`charts.months.${mo}` as any);
        const rev = completedTransactions
          .filter((tx) => {
            const d = new Date(tx.date);
            return tx.type === 'INCOME' && d.getFullYear() === y && d.getMonth() === mo;
          })
          .reduce((s, tx) => s + tx.amount, 0);

        const exp = completedTransactions
          .filter((tx) => {
            const d = new Date(tx.date);
            return tx.type === 'EXPENSE' && d.getFullYear() === y && d.getMonth() === mo;
          })
          .reduce((s, tx) => s + tx.amount, 0);

        return { label, revenue: rev, expenses: exp };
      });
    }

    // Custom date range: auto-bucket
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 31) {
      // Daily buckets
      const buckets = [];
      const curr = new Date(start);
      while (curr <= end) {
        const dStr = toIsoDate(curr);
        const label = `${curr.getMonth() + 1}/${curr.getDate()}`;
        const rev = completedTransactions
          .filter((tx) => tx.type === 'INCOME' && tx.date.slice(0, 10) === dStr)
          .reduce((s, tx) => s + tx.amount, 0);
        const exp = completedTransactions
          .filter((tx) => tx.type === 'EXPENSE' && tx.date.slice(0, 10) === dStr)
          .reduce((s, tx) => s + tx.amount, 0);
        buckets.push({ label, revenue: rev, expenses: exp });
        curr.setDate(curr.getDate() + 1);
      }
      return buckets;
    }

    // Monthly buckets for longer custom spans
    const buckets = [];
    const curr = new Date(start.getFullYear(), start.getMonth(), 1);
    while (curr <= end) {
      const cy = curr.getFullYear();
      const cm = curr.getMonth();
      const label = `${t(`charts.months.${cm}` as any)} ${cy !== y ? cy : ''}`.trim();
      const rev = completedTransactions
        .filter((tx) => {
          const d = new Date(tx.date);
          return (
            tx.type === 'INCOME' &&
            d >= start &&
            d <= end &&
            d.getFullYear() === cy &&
            d.getMonth() === cm
          );
        })
        .reduce((s, tx) => s + tx.amount, 0);
      const exp = completedTransactions
        .filter((tx) => {
          const d = new Date(tx.date);
          return (
            tx.type === 'EXPENSE' &&
            d >= start &&
            d <= end &&
            d.getFullYear() === cy &&
            d.getMonth() === cm
          );
        })
        .reduce((s, tx) => s + tx.amount, 0);

      buckets.push({ label, revenue: rev, expenses: exp });
      curr.setMonth(curr.getMonth() + 1);
    }
    return buckets;
  }, [completedTransactions, period.kind, start, end, t]);

  // §3.4 Top clients by revenue
  const clientRevenueRows = useMemo(() => {
    return clients
      .map((client) => {
        const rev = periodTxs
          .filter(
            (tx) =>
              tx.type === 'INCOME' &&
              (tx.clientId === client.id ||
                (tx.sourceType === 'client' && tx.sourceId === client.id)),
          )
          .reduce((s, tx) => s + tx.amount, 0);
        return { id: client.id, name: client.name, revenue: rev };
      })
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [clients, periodTxs]);

  const totalClientRevenue = useMemo(
    () => clientRevenueRows.reduce((sum, c) => sum + c.revenue, 0),
    [clientRevenueRows],
  );

  // §3.5 Expense breakdown by category (subscriptions folded in)
  const categoryRows = useMemo(() => {
    const map: Record<string, number> = {};
    periodTxs
      .filter((tx) => tx.type === 'EXPENSE')
      .forEach((tx) => {
        const cat = tx.categoryId || 'OTHER';
        map[cat] = (map[cat] || 0) + tx.amount;
      });

    return Object.entries(map).map(([categoryId, amount]) => ({
      categoryId,
      amount,
    }));
  }, [periodTxs]);

  // Export handlers
  const handleExportCsv = useCallback(() => {
    const exportStart = toIsoDate(start);
    const exportEnd = toIsoDate(end);

    const totalExp = categoryRows.reduce((s, c) => s + c.amount, 0);

    exportAnalyticsToCsv({
      start: exportStart,
      end: exportEnd,
      currency,
      summary: {
        revenue: periodRevenue,
        expenses: periodExpenses,
        netProfit: periodProfit,
        profitMargin: periodRevenue > 0 ? Math.round((periodProfit / periodRevenue) * 100) : 0,
        pendingTotal,
        pendingCount,
      },
      buckets: chartBuckets,
      topClients: clientRevenueRows.map((c) => ({
        name: c.name,
        revenue: c.revenue,
        percentage:
          totalClientRevenue > 0 ? Math.round((c.revenue / totalClientRevenue) * 100) : 0,
      })),
      categories: categoryRows.map((c) => ({
        category: c.categoryId,
        amount: c.amount,
        percentage: totalExp > 0 ? Math.round((c.amount / totalExp) * 100) : 0,
      })),
    });
  }, [
    start,
    end,
    currency,
    periodRevenue,
    periodExpenses,
    periodProfit,
    pendingTotal,
    pendingCount,
    chartBuckets,
    clientRevenueRows,
    totalClientRevenue,
    categoryRows,
  ]);

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const { exportAnalyticsToPdf } = await import('@/lib/analyticsExport');
      const exportStart = toIsoDate(start);
      const exportEnd = toIsoDate(end);

      const totalExp = categoryRows.reduce((s, c) => s + c.amount, 0);

      await exportAnalyticsToPdf({
        start: exportStart,
        end: exportEnd,
        currency,
        summary: {
          revenue: periodRevenue,
          expenses: periodExpenses,
          netProfit: periodProfit,
          profitMargin: periodRevenue > 0 ? Math.round((periodProfit / periodRevenue) * 100) : 0,
          pendingTotal,
          pendingCount,
        },
        buckets: chartBuckets,
        topClients: clientRevenueRows.map((c) => ({
          name: c.name,
          revenue: c.revenue,
          percentage:
            totalClientRevenue > 0 ? Math.round((c.revenue / totalClientRevenue) * 100) : 0,
        })),
        categories: categoryRows.map((c) => ({
          category: c.categoryId,
          amount: c.amount,
          percentage: totalExp > 0 ? Math.round((c.amount / totalExp) * 100) : 0,
        })),
      });
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    start,
    end,
    currency,
    periodRevenue,
    periodExpenses,
    periodProfit,
    pendingTotal,
    pendingCount,
    chartBuckets,
    clientRevenueRows,
    totalClientRevenue,
    categoryRows,
  ]);

  const exportMenuItems: MenuItem[] = useMemo(
    () => [
      {
        label: t('analytics.export.csv'),
        icon: 'FileText',
        onClick: handleExportCsv,
      },
      {
        label: isExportingPdf ? `${t('analytics.export.pdf')}…` : t('analytics.export.pdf'),
        icon: isExportingPdf ? 'RefreshCw' : 'File',
        disabled: isExportingPdf,
        onClick: handleExportPdf,
      },
    ],
    [handleExportCsv, handleExportPdf, isExportingPdf, t],
  );

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) {
      setCustomError(t('analytics.custom.invalidRange'));
      return;
    }
    setCustomError(null);
    updatePeriod({ kind: 'custom', start: customStart, end: customEnd });
    setCustomOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      {/* ── §3.0 Header + period filter + export ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="t-h1">{t('nav.analytics')}</h1>
          <p className="t-body mt-1 text-text-muted">{t('topbar.copy.analytics.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap" dir={dir}>
          {/* Segmented Month / Quarter / Year */}
          <Segmented
            options={[
              { label: t('analytics.period.month'), value: 'month' },
              { label: t('analytics.period.quarter'), value: 'quarter' },
              { label: t('analytics.period.year'), value: 'year' },
            ]}
            value={period.kind === 'custom' ? undefined : period.kind}
            onChange={(val) => updatePeriod({ kind: val as 'month' | 'quarter' | 'year' })}
          />

          {/* Custom Date Range Trigger & Popover */}
          <div className="relative inline-block" ref={popoverRef}>
            <Button
              variant={period.kind === 'custom' ? 'primary' : 'secondary'}
              size="sm"
              icon="Calendar"
              onClick={() => setCustomOpen((prev) => !prev)}
              aria-expanded={customOpen}
            >
              {period.kind === 'custom'
                ? `${period.start} → ${period.end}`
                : t('analytics.period.custom')}
            </Button>

            {customOpen && (
              <div
                className="absolute z-[120] p-4 rounded-md border border-border bg-surface-elevated shadow-lg anim-scale mt-1.5 w-[280px]"
                style={{ [dir === 'rtl' ? 'left' : 'right']: 0 }}
                dir={dir}
              >
                <div className="text-xs font-semibold text-text mb-3">
                  {t('analytics.custom.title')}
                </div>
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">
                      {t('analytics.custom.startDate')}
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setCustomStart(e.target.value);
                        setCustomError(null);
                      }}
                      className="w-full h-8 px-2 text-xs rounded-sm border border-border bg-surface text-text focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">
                      {t('analytics.custom.endDate')}
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => {
                        setCustomEnd(e.target.value);
                        setCustomError(null);
                      }}
                      className="w-full h-8 px-2 text-xs rounded-sm border border-border bg-surface text-text focus-ring"
                    />
                  </div>
                  {customError && (
                    <div className="text-[11px] text-negative font-medium">{customError}</div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomOpen(false)}
                    >
                      {t('analytics.custom.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleApplyCustom}>
                      {t('analytics.custom.apply')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Menu */}
          <Menu
            items={exportMenuItems}
            align={dir === 'rtl' ? 'left' : 'right'}
            trigger={
              <Button
                variant="secondary"
                size="sm"
                icon="Download"
                aria-label={t('analytics.export.button')}
              >
                <span className="hidden sm:inline">{t('analytics.export.button')}</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* ── §3.1 KPI Strip: Flush, not cards, count-up motion ── */}
      <div className="border-y border-border grid grid-cols-2 sm:grid-cols-4 sm:divide-x divide-border">
        {/* Revenue */}
        <div className="p-3 sm:px-4 sm:py-3 border-b border-border sm:border-b-0 flex flex-col gap-1">
          <span className="t-caption text-text-muted">{t('analytics.stats.revenue')}</span>
          <div className="t-h2 tnum text-positive" dir="ltr">
            {moneyLong.format(animatedRevenue)}
          </div>
          <div className="flex items-center gap-1 min-h-[18px]">
            {revenueDelta != null && <DeltaChip value={revenueDelta} />}
          </div>
        </div>

        {/* Net Income */}
        <div className="p-3 sm:px-4 sm:py-3 border-b border-inline-start border-border sm:border-b-0 sm:border-inline-start-0 flex flex-col gap-1">
          <span className="t-caption text-text-muted">{t('analytics.stats.netIncome')}</span>
          <div
            className={`t-h2 tnum ${animatedProfit >= 0 ? 'text-positive' : 'text-negative'}`}
            dir="ltr"
          >
            {moneyLong.format(animatedProfit)}
          </div>
          <div className="flex items-center gap-1 min-h-[18px]">
            {profitDelta != null && <DeltaChip value={profitDelta} />}
          </div>
        </div>

        {/* Pending Payments (Clickable → /clients#pending) */}
        <Link
          href="/clients#pending"
          aria-label={t('analytics.stats.pendingLinkAria')}
          className="p-3 sm:px-4 sm:py-3 flex flex-col gap-1 group hover:bg-surface-hover/60 transition-colors focus-ring rounded-sm"
        >
          <span className="t-caption text-text-muted group-hover:text-text transition-colors">
            {t('analytics.stats.pending')}
          </span>
          <div className="t-h2 tnum text-pending" dir="ltr">
            {moneyLong.format(animatedPending)}
          </div>
          <div className="text-xs text-text-muted">
            {t('analytics.stats.pendingAwaiting', { count: animatedPendingCount })}
          </div>
        </Link>

        {/* Expenses */}
        <div className="p-3 sm:px-4 sm:py-3 border-inline-start border-border sm:border-inline-start-0 flex flex-col gap-1">
          <span className="t-caption text-text-muted">{t('analytics.stats.expenses')}</span>
          <div className="t-h2 tnum text-negative" dir="ltr">
            {moneyLong.format(animatedExpenses)}
          </div>
          <div className="flex items-center gap-1 min-h-[18px]">
            {expensesDelta != null && <DeltaChip value={expensesDelta} inverse />}
          </div>
        </div>
      </div>

      {/* ── §3.2 Revenue trend — the HERO (tier="raised") ── */}
      <Card tier="raised" pad={28} className="min-h-[340px]">
        <SectionHeader
          title={t('analytics.trend.title')}
          sub={t('analytics.trend.subtitle')}
        />
        <RevenueTrendChart data={trailing12Months} formatAmount={money.format} />
      </Card>

      {/* ── §3.3 & §3.4 Mid row: Income vs Expenses & Top 5 Clients (tier="base") ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Income vs Expenses grouped bar chart */}
        <Card tier="base" pad={20}>
          <SectionHeader
            title={t('analytics.chart.revenueVsExpenses')}
            sub={breakdownSub}
          />
          <IncomeExpenseBarChart
            data={chartBuckets}
            formatAmount={money.format}
            periodLabel={periodLabel}
          />
        </Card>

        {/* Top 5 Clients with bars */}
        <Card tier="base" pad={20}>
          <SectionHeader
            title={t('analytics.clients.top5')}
            sub={t('analytics.clients.subtitle', {
              clients: clientRevenueRows.length,
              amount: money.format(totalClientRevenue),
            })}
          />
          <TopClientsBarChart
            clients={clientRevenueRows}
            formatAmount={money.format}
          />
        </Card>
      </div>

      {/* ── §3.5 Expense breakdown by category (tier="base") ── */}
      <Card tier="base" pad={20}>
        <SectionHeader
          title={t('analytics.categories.title')}
          sub={t('analytics.categories.subtitle', { count: categoryRows.length })}
        />
        <ExpenseCategoryBarChart
          categories={categoryRows}
          formatAmount={money.format}
          periodLabel={periodLabel}
        />
      </Card>

      {/* ── §3.6 Summary strip — flush, four items, border-t (all-time totals) ── */}
      <Card tier="flush" className="border-t border-border pt-4">
        <SectionHeader title={t('analytics.summary.title')} className="mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" dir={dir}>
          <div>
            <div className="t-caption text-text-muted">{t('analytics.summary.totalRevenue')}</div>
            <div className="t-h3 tnum mt-1 text-positive" dir="ltr">
              {moneyLong.format(overview.totalRevenue)}
            </div>
          </div>
          <div>
            <div className="t-caption text-text-muted">{t('analytics.summary.netProfit')}</div>
            <div
              className={`t-h3 tnum mt-1 ${overview.netProfit >= 0 ? 'text-positive' : 'text-negative'}`}
              dir="ltr"
            >
              {moneyLong.format(overview.netProfit)}
            </div>
          </div>
          <div>
            <div className="t-caption text-text-muted">{t('analytics.summary.avgClient')}</div>
            <div className="t-h3 tnum mt-1 text-text" dir="ltr">
              {moneyLong.format(
                overview.totalClients > 0 ? overview.totalRevenue / overview.totalClients : 0,
              )}
            </div>
          </div>
          <div>
            <div className="t-caption text-text-muted">{t('analytics.summary.toolsPerMonth')}</div>
            <div className="t-h3 tnum mt-1 text-negative" dir="ltr">
              {moneyLong.format(overview.subscriptionBurden)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
