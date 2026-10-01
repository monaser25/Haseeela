'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '@/lib/i18n';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { Icon } from '@/components/ui/Icon';

export interface IncomeExpenseRow {
  label: string;
  revenue: number;
  expenses: number;
  isCurrent?: boolean;
}

export interface IncomeExpenseBarChartProps {
  data: IncomeExpenseRow[];
  formatAmount: (value: number) => string;
  periodLabel: string;
}

export function IncomeExpenseBarChart({
  data,
  formatAmount,
  periodLabel,
}: IncomeExpenseBarChartProps) {
  const { t, dir } = useLocale();
  const reducedMotion = usePrefersReducedMotion();
  const [showTable, setShowTable] = useState(false);

  const allZero = useMemo(
    () => data.every((d) => d.revenue === 0 && d.expenses === 0),
    [data],
  );

  const currentBucketIndex = useMemo(() => {
    // 1. Explicit per-row flag takes highest priority
    const explicitIndex = data.findIndex((d) => d.isCurrent);
    if (explicitIndex !== -1) return explicitIndex;

    // 2. Derive current bucket containing today's date based on period
    const now = new Date();

    const isMonth =
      periodLabel === t('analytics.periodLabel.month') ||
      periodLabel === 'This month' ||
      periodLabel === 'هذا الشهر';

    if (isMonth) {
      // Month view -> the week containing today (days 1-7 = week 0, etc.)
      const weekIndex = Math.floor((now.getDate() - 1) / 7);
      if (weekIndex >= 0 && weekIndex < data.length) {
        return weekIndex;
      }
      return -1;
    }

    const isQuarter =
      periodLabel === t('analytics.periodLabel.quarter') ||
      periodLabel === 'This quarter' ||
      periodLabel === 'هذا الربع';

    if (isQuarter) {
      // Quarter view -> the month containing today (0, 1, 2)
      const quarterMonthIndex = now.getMonth() % 3;
      if (quarterMonthIndex >= 0 && quarterMonthIndex < data.length) {
        return quarterMonthIndex;
      }
      return -1;
    }

    const isYear =
      periodLabel === t('analytics.periodLabel.year') ||
      periodLabel === 'This year' ||
      periodLabel === 'هذه السنة';

    if (isYear) {
      // Year view -> the month containing today (0 to 11)
      const monthIndex = now.getMonth();
      if (monthIndex >= 0 && monthIndex < data.length) {
        return monthIndex;
      }
      return -1;
    }

    // Fallback: If the selected period does not include today
    // (a past month, a custom historical range), highlight nothing.
    return -1;
  }, [data, periodLabel, t]);

  const hasHighlight = currentBucketIndex >= 0;
  const currentBucket = hasHighlight ? data[currentBucketIndex] : null;

  const baseAriaLabel = t('analytics.chart.aria', { period: periodLabel });
  const ariaLabel = currentBucket
    ? `${baseAriaLabel} (${t('analytics.chart.currentHint', { bucket: currentBucket.label })})`
    : baseAriaLabel;

  const margin =
    dir === 'rtl'
      ? { top: 12, right: 36, left: 10, bottom: 0 }
      : { top: 12, right: 10, left: 0, bottom: 0 };

  return (
    <div className="flex flex-col w-full">
      {allZero ? (
        <div className="h-[280px] w-full flex flex-col items-center justify-center text-sm text-text-muted gap-2">
          <Icon name="Receipt" size={32} className="opacity-40" />
          <p>{t('analytics.empty.transactions')}</p>
        </div>
      ) : (
        <div
          role="img"
          aria-label={ariaLabel}
          title={ariaLabel}
          className="h-[280px] w-full mt-2"
          dir="ltr"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              barGap={4}
              barCategoryGap="28%"
              margin={margin}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                dy={8}
                reversed={dir === 'rtl'}
              />
              <YAxis
                width={76}
                orientation={dir === 'rtl' ? 'right' : 'left'}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatAmount(Number(v))}
                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-hover)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const rev = Number(payload.find((p) => p.dataKey === 'revenue')?.value || 0);
                  const exp = Number(payload.find((p) => p.dataKey === 'expenses')?.value || 0);
                  const net = rev - exp;
                  return (
                    <div
                      className="bg-surface-elevated border border-border rounded-md shadow-lg p-2.5 text-xs min-w-[140px]"
                      dir={dir}
                    >
                      <div className="text-text-muted mb-1.5 font-medium">{label}</div>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-text-secondary flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-positive inline-block" />
                          {t('analytics.stats.revenue')}
                        </span>
                        <span className="font-mono tnum text-positive-text" dir="ltr">
                          {formatAmount(rev)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-text-secondary flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-negative inline-block" />
                          {t('analytics.stats.expenses')}
                        </span>
                        <span className="font-mono tnum text-negative-text" dir="ltr">
                          {formatAmount(exp)}
                        </span>
                      </div>
                      <div className="pt-1 mt-1 border-t border-border flex items-center justify-between gap-3">
                        <span className="text-text-muted">{t('analytics.table.net')}</span>
                        <span
                          className={`font-mono tnum ${net >= 0 ? 'text-positive-text' : 'text-negative-text'}`}
                          dir="ltr"
                        >
                          {formatAmount(net)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
                content={() => (
                  <div className="flex items-center justify-end gap-4 text-xs text-text-secondary pb-2" dir={dir}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-positive inline-block" />
                      <span>{t('analytics.stats.revenue')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-negative inline-block" />
                      <span>{t('analytics.stats.expenses')}</span>
                    </div>
                  </div>
                )}
              />
              <Bar
                dataKey="revenue"
                fill="var(--positive)"
                radius={[4, 4, 0, 0]}
                name={t('analytics.stats.revenue')}
                isAnimationActive={!reducedMotion}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`rev-cell-${index}`}
                    fill="var(--positive)"
                    fillOpacity={hasHighlight ? (index === currentBucketIndex ? 1 : 0.35) : 1}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="expenses"
                fill="var(--negative)"
                radius={[4, 4, 0, 0]}
                name={t('analytics.stats.expenses')}
                isAnimationActive={!reducedMotion}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`exp-cell-${index}`}
                    fill="var(--negative)"
                    fillOpacity={hasHighlight ? (index === currentBucketIndex ? 1 : 0.35) : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Accessibility: Table view disclosure */}
      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="text-xs text-text-muted hover:text-text focus-ring rounded-sm py-1 px-1.5 inline-flex items-center gap-1.5 transition-colors"
          aria-expanded={showTable}
        >
          <Icon name={showTable ? 'EyeOff' : 'Table'} size={14} />
          <span>{showTable ? t('analytics.table.hide') : t('analytics.table.view')}</span>
        </button>
      </div>

      {showTable && (
        <div className="mt-2 overflow-x-auto border-t border-border pt-3" dir={dir}>
          <table className="w-full text-xs text-start">
            <caption className="sr-only">{t('analytics.chart.revenueVsExpenses')}</caption>
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 text-start font-medium">{t('analytics.table.period')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.revenue')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.expenses')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.net')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.map((row) => {
                const net = row.revenue - row.expenses;
                return (
                  <tr key={row.label} className="hover:bg-surface-hover/50">
                    <td className="py-1.5 text-start text-text-secondary">{row.label}</td>
                    <td className="py-1.5 text-end font-mono tnum text-positive-text" dir="ltr">
                      {formatAmount(row.revenue)}
                    </td>
                    <td className="py-1.5 text-end font-mono tnum text-negative-text" dir="ltr">
                      {formatAmount(row.expenses)}
                    </td>
                    <td
                      className={`py-1.5 text-end font-mono tnum ${net >= 0 ? 'text-positive-text' : 'text-negative-text'}`}
                      dir="ltr"
                    >
                      {formatAmount(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
