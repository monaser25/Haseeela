'use client';

import { useMemo, useState } from 'react';
import { useLocale } from '@/lib/i18n';
import { latinTokenClass } from '@/lib/textDirection';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { CHART_SERIES } from '@/lib/chartTheme';

export interface ClientRevenueItem {
  id: string;
  name: string;
  revenue: number;
}

export interface TopClientsBarChartProps {
  clients: ClientRevenueItem[];
  formatAmount: (value: number) => string;
}

export function TopClientsBarChart({ clients, formatAmount }: TopClientsBarChartProps) {
  const { t, dir } = useLocale();
  const [showTable, setShowTable] = useState(false);

  // Filter clients with revenue > 0
  const activeRevenueClients = useMemo(
    () => clients.filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue),
    [clients],
  );

  const totalRevenue = useMemo(
    () => activeRevenueClients.reduce((sum, c) => sum + c.revenue, 0),
    [activeRevenueClients],
  );

  // Cap at 5 rows, rest summarized into "+N more"
  const top5 = useMemo(() => activeRevenueClients.slice(0, 5), [activeRevenueClients]);
  const remainder = useMemo(() => activeRevenueClients.slice(5), [activeRevenueClients]);
  const remainderRevenue = useMemo(
    () => remainder.reduce((sum, c) => sum + c.revenue, 0),
    [remainder],
  );
  const remainderPct =
    totalRevenue > 0 ? Math.round((remainderRevenue / totalRevenue) * 100) : 0;

  const ariaLabel = t('analytics.clients.aria');

  return (
    <div className="flex flex-col w-full">
      {activeRevenueClients.length === 0 ? (
        <div className="h-[240px] w-full flex flex-col items-center justify-center text-sm text-text-muted gap-2">
          <Icon name="Users" size={32} className="opacity-40" />
          <p>{t('analytics.clients.empty')}</p>
        </div>
      ) : (
        <div
          role="img"
          aria-label={ariaLabel}
          className="flex flex-col gap-3 mt-3"
        >
          {top5.map((client, idx) => {
            const pct = totalRevenue > 0 ? Math.round((client.revenue / totalRevenue) * 100) : 0;
            const barColor = CHART_SERIES[idx % CHART_SERIES.length];

            return (
              <div key={client.id} className="flex items-center gap-3" dir={dir}>
                <span className="t-body-m font-mono text-text-muted w-4 text-center">
                  {idx + 1}
                </span>
                <Avatar name={client.name} size={30} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className={`t-body-m truncate text-text font-medium ${latinTokenClass(client.name)}`}>
                      {client.name}
                    </span>
                    <span className="t-body-m font-mono tnum text-text ms-2" dir="ltr">
                      {formatAmount(client.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden" dir="ltr">
                    <div
                      className="h-full rounded-full transition-all duration-base"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs font-mono text-text-muted w-9 text-end" dir="ltr">
                  {pct}%
                </span>
              </div>
            );
          })}

          {/* "+N more" aggregate row if remainder exists */}
          {remainder.length > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t border-border/60" dir={dir}>
              <span className="t-body-m font-mono text-text-muted w-4 text-center">…</span>
              <div className="w-[30px] h-[30px] rounded-full bg-surface-hover flex items-center justify-center text-text-muted">
                <Icon name="Users" size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="t-body-m text-text-secondary">
                    {t('analytics.clients.more', { count: remainder.length })}
                  </span>
                  <span className="t-body-m font-mono tnum text-text-secondary ms-2" dir="ltr">
                    {formatAmount(remainderRevenue)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden" dir="ltr">
                  <div
                    className="h-full rounded-full bg-border-strong transition-all duration-base"
                    style={{ width: `${Math.max(remainderPct, 2)}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono text-text-muted w-9 text-end" dir="ltr">
                {remainderPct}%
              </span>
            </div>
          )}
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
            <caption className="sr-only">{t('analytics.clients.title')}</caption>
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 text-start font-medium w-8">#</th>
                <th className="py-2 text-start font-medium">{t('analytics.table.client')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.revenue')}</th>
                <th className="py-2 text-end font-medium">{t('analytics.table.percentage')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activeRevenueClients.map((client, idx) => {
                const pct =
                  totalRevenue > 0 ? Math.round((client.revenue / totalRevenue) * 100) : 0;
                return (
                  <tr key={client.id} className="hover:bg-surface-hover/50">
                    <td className="py-1.5 text-start font-mono text-text-muted">{idx + 1}</td>
                    <td className={`py-1.5 text-start text-text ${latinTokenClass(client.name)}`}>
                      {client.name}
                    </td>
                    <td className="py-1.5 text-end font-mono tnum text-text" dir="ltr">
                      {formatAmount(client.revenue)}
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
