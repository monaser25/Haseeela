'use client';

import { useMemo, useState } from 'react';
import { useLocale } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import { categoryLabel } from '@/lib/enumLabels';
import { CHART_SERIES } from '@/lib/chartTheme';

export interface CategoryExpenseItem {
  categoryId: string;
  amount: number;
}

export interface ExpenseCategoryBarChartProps {
  categories: CategoryExpenseItem[];
  formatAmount: (value: number) => string;
  periodLabel: string;
}

export function ExpenseCategoryBarChart({
  categories,
  formatAmount,
  periodLabel,
}: ExpenseCategoryBarChartProps) {
  const { t, dir } = useLocale();
  const [showTable, setShowTable] = useState(false);

  const sortedCategories = useMemo(
    () =>
      categories
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [categories],
  );

  const totalExpense = useMemo(
    () => sortedCategories.reduce((sum, c) => sum + c.amount, 0),
    [sortedCategories],
  );

  const ariaLabel = t('analytics.categories.aria');

  return (
    <div className="flex flex-col w-full">
      {sortedCategories.length === 0 ? (
        <div className="h-[240px] w-full flex flex-col items-center justify-center text-sm text-text-muted gap-2">
          <Icon name="PieChart" size={32} className="opacity-40" />
          <p>{t('analytics.categories.empty', { period: periodLabel.toLowerCase() })}</p>
        </div>
      ) : (
        <div
          role="img"
          aria-label={ariaLabel}
          className="flex flex-col gap-3 mt-3"
        >
          {sortedCategories.map((item, idx) => {
            const label = categoryLabel(item.categoryId, t);
            const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
            const barColor = CHART_SERIES[idx % CHART_SERIES.length];

            return (
              <div key={item.categoryId} className="flex flex-col gap-1.5" dir={dir}>
                <div className="flex justify-between items-baseline text-sm">
                  <span className="font-medium text-text">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono tnum text-text font-medium" dir="ltr">
                      {formatAmount(item.amount)}
                    </span>
                    <span className="text-xs font-mono text-text-muted w-9 text-end" dir="ltr">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface-hover overflow-hidden" dir="ltr">
                  <div
                    className="h-full rounded-full transition-all duration-base"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessibility: Table view disclosure */}
      <div className="mt-4 flex items-center justify-end">
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
            <caption className="sr-only">{t('analytics.categories.title')}</caption>
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 text-start font-medium">{t('analytics.table.category')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.amount')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.percentage')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortedCategories.map((item) => {
                const label = categoryLabel(item.categoryId, t);
                const pct =
                  totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
                return (
                  <tr key={item.categoryId} className="hover:bg-surface-hover/50">
                    <td className="py-1.5 text-start text-text">{label}</td>
                    <td className="py-1.5 text-end font-mono tnum text-text" dir="ltr">
                      {formatAmount(item.amount)}
                    </td>
                    <td className="py-1.5 text-end font-mono tnum text-text-muted" dir="ltr">
                      {pct}%
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
