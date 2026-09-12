'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '@/lib/i18n';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { Icon } from '@/components/ui/Icon';

export interface RevenueTrendPoint {
  key: string;
  label: string;
  revenue: number;
}

export interface RevenueTrendChartProps {
  data: RevenueTrendPoint[];
  formatAmount: (value: number) => string;
}

export function RevenueTrendChart({ data, formatAmount }: RevenueTrendChartProps) {
  const { t, dir } = useLocale();
  const reducedMotion = usePrefersReducedMotion();
  const [showTable, setShowTable] = useState(false);

  const allZero = useMemo(() => data.every((d) => d.revenue === 0), [data]);

  const { minRev, maxRev, direction } = useMemo(() => {
    if (!data.length) return { minRev: 0, maxRev: 0, direction: 'flat' };
    const revs = data.map((d) => d.revenue);
    const min = Math.min(...revs);
    const max = Math.max(...revs);

    const firstCount = Math.min(3, data.length);
    const lastCount = Math.min(3, data.length);
    const firstAvg = data.slice(0, firstCount).reduce((s, d) => s + d.revenue, 0) / firstCount;
    const lastAvg = data.slice(-lastCount).reduce((s, d) => s + d.revenue, 0) / lastCount;

    let dirString = t('analytics.trend.trendingFlat');
    if (lastAvg > firstAvg * 1.05) {
      dirString = t('analytics.trend.trendingUp');
    } else if (lastAvg < firstAvg * 0.95) {
      dirString = t('analytics.trend.trendingDown');
    }

    return { minRev: min, maxRev: max, direction: dirString };
  }, [data, t]);

  const ariaLabel = t('analytics.trend.aria', {
    min: formatAmount(minRev),
    max: formatAmount(maxRev),
    direction,
  });

  const margin =
    dir === 'rtl'
      ? { top: 12, right: 36, left: 10, bottom: 0 }
      : { top: 12, right: 10, left: 0, bottom: 0 };

  return (
    <div className="flex flex-col w-full">
      {/* Chart container or empty state */}
      {allZero ? (
        <div className="h-[280px] w-full flex flex-col items-center justify-center text-sm text-text-muted gap-2">
          <Icon name="TrendingUp" size={32} className="opacity-40" />
          <p>{t('analytics.trend.empty')}</p>
        </div>
      ) : (
        <div
          role="img"
          aria-label={ariaLabel}
          className="h-[280px] w-full mt-2"
          dir="ltr"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={margin}>
              <defs>
                <linearGradient id="revenueTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const val = Number(payload[0].value || 0);
                  return (
                    <div
                      className="bg-surface-elevated border border-border rounded-md shadow-lg p-2.5 text-xs"
                      dir={dir}
                    >
                      <div className="text-text-muted mb-1 font-medium">{label}</div>
                      <div className="t-h3 tnum text-text" dir="ltr">
                        {formatAmount(val)}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                fill="url(#revenueTrendGrad)"
                stroke="none"
                isAnimationActive={!reducedMotion}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--accent)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: 'var(--accent)',
                  stroke: 'var(--surface-elevated)',
                  strokeWidth: 2,
                }}
                isAnimationActive={!reducedMotion}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </ComposedChart>
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
            <caption className="sr-only">{t('analytics.trend.title')}</caption>
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 text-start font-medium">{t('analytics.table.month')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.revenue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.map((row) => (
                <tr key={row.key} className="hover:bg-surface-hover/50">
                  <td className="py-1.5 text-start text-text-secondary">{row.label}</td>
                  <td className="py-1.5 text-end font-mono tnum text-text" dir="ltr">
                    {formatAmount(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
