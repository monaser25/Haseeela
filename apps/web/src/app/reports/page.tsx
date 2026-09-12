'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useFinancialStore } from '@/store/financialStore';
import { loadReportAPI, downloadReportCsv, downloadReportXlsx, type ReportData } from '@/services/financialApi';
import { makeCompactCurrencyFormatter } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Segmented } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineAlert } from '@/components/ui/InlineAlert';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfMonth = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const startOfQuarter = () => { const d = new Date(); return iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)); };
const startOfYear = () => iso(new Date(new Date().getFullYear(), 0, 1));
const todayStr = () => iso(new Date());

// Intercept fetch to inject the locale query parameter into /api/reports calls
// since we cannot modify the API wrapper signatures.
const withLocaleQuery = <T,>(locale: string, fn: () => Promise<T>): Promise<T> => {
  const originalFetch = window.fetch;
  window.fetch = async (url, options) => {
    if (typeof url === 'string' && url.includes('/api/reports')) {
      const u = new URL(url, window.location.origin);
      u.searchParams.set('locale', locale);
      return originalFetch(u.toString(), options);
    }
    return originalFetch(url, options);
  };
  return fn().finally(() => {
    window.fetch = originalFetch;
  });
};

export default function ReportsPage() {
  const { currency, transactions } = useFinancialStore();
  const { locale, t, dir } = useLocale();
  const { toast } = useToast();

  const REPORT_TYPES = useMemo(() => [
    { id: 'pl', label: t('reports.types.pl.label'), icon: 'trendingUp', desc: t('reports.types.pl.desc') },
    { id: 'transactions', label: t('reports.types.transactions.label'), icon: 'walletCards', desc: t('reports.types.transactions.desc') },
    { id: 'clients', label: t('reports.types.clients.label'), icon: 'users', desc: t('reports.types.clients.desc') },
    { id: 'tax', label: t('reports.types.tax.label'), icon: 'fileBarChart', desc: t('reports.types.tax.desc') },
  ], [t]);

  // "All time" should start at the first recorded transaction, not an arbitrary
  // year 2000 — keeps the range meaningful and the printed header tidy.
  const earliestTxDate = useMemo(() => {
    const dates = transactions
      .map((tx) => tx.date)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return dates.length > 0 ? iso(new Date(dates[0])) : startOfYear();
  }, [transactions]);
  
  const [type, setType] = useState('pl');
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const money = useMemo(() => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale), [currency, locale]);
  const money2 = useMemo(() => makeCompactCurrencyFormatter(currency, { minimumFractionDigits: 2 }, locale), [currency, locale]);
  const activePreset = useMemo(() => {
    if (from === startOfMonth()) return 'month';
    if (from === startOfQuarter()) return 'quarter';
    if (from === startOfYear()) return 'year';
    if (from === earliestTxDate) return 'all';
    return 'custom';
  }, [earliestTxDate, from]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    withLocaleQuery(locale, () => loadReportAPI(type, from, to))
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : t('reports.ui.errorTitle')); })
      .finally(() => { if (!cancelled) setLoading(false); });
      
    return () => { cancelled = true; };
  }, [type, from, to, locale, t]);

  const setPreset = (preset: string) => {
    if (preset === 'month') setFrom(startOfMonth());
    else if (preset === 'quarter') setFrom(startOfQuarter());
    else if (preset === 'year') setFrom(startOfYear());
    else if (preset === 'all') setFrom(earliestTxDate);
    setTo(todayStr());
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportAs = async (kind: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const { blob, filename } = kind === 'xlsx'
        ? await withLocaleQuery(locale, () => downloadReportXlsx(type, from, to))
        : await withLocaleQuery(locale, () => downloadReportCsv(type, from, to));
      triggerDownload(blob, filename);
      toast(kind === 'xlsx' ? t('reports.ui.exportExcelSuccess') : t('reports.ui.exportCsvSuccess'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('reports.ui.exportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const fmtCell = (val: string | number, numeric?: boolean) =>
    numeric && typeof val === 'number' ? (
      <span dir="ltr">{money2.format(val)}</span>
    ) : (
      String(val)
    );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="t-h1">{t('reports.ui.title')}</h1>
        <p className="t-body text-text-muted mt-1">{t('reports.ui.subtitle')}</p>
      </div>

      {/* Report type cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        {REPORT_TYPES.map((r) => {
          const active = type === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setType(r.id)}
              className={`text-left p-4 rounded-lg border transition-colors focus-ring ${active ? 'border-accent bg-accent-tint' : 'border-border bg-surface hover:bg-surface-hover'}`}
            >
              <span className={`inline-flex w-9 h-9 rounded-md items-center justify-center mb-2 ${active ? 'bg-accent text-white' : 'bg-surface-hover text-text-secondary'}`}>
                <Icon name={r.icon as any} size={18} />
              </span>
              <div className={`t-body-m ${active ? 'text-accent' : ''}`}>{r.label}</div>
              <div className="t-small text-text-muted mt-0.5">{r.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <Card pad={18} className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap print:hidden">
        <div className="flex flex-col gap-1.5">
          <span className="t-body-m text-text-secondary">{t('reports.ui.period')}</span>
          <Segmented
            value={activePreset}
            onChange={setPreset}
            options={[
              { value: 'month', label: t('reports.ui.presets.month') }, 
              { value: 'quarter', label: t('reports.ui.presets.quarter') }, 
              { value: 'year', label: t('reports.ui.presets.year') }, 
              { value: 'all', label: t('reports.ui.presets.all') }
            ]}
          />
        </div>
        <Field label={t('reports.ui.from')} className="w-[150px]"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t('reports.ui.to')} className="w-[150px]"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button variant="secondary" icon="printer" onClick={() => window.print()} disabled={!report || report.rows.length === 0}>{t('reports.ui.printPdf')}</Button>
          <Button variant="secondary" icon="download" loading={exporting} onClick={() => exportAs('csv')} disabled={!report || report.rows.length === 0}>{t('reports.ui.csv')}</Button>
          <Button icon="download" loading={exporting} onClick={() => exportAs('xlsx')} disabled={!report || report.rows.length === 0}>{t('reports.ui.excel')}</Button>
        </div>
      </Card>

      {error && <InlineAlert tone="negative" title={t('reports.ui.errorTitle')} body={error} />}

      {/* Preview */}
      <div id="report-document" dir={dir}>
        {/* Branded letterhead — only rendered in the printed/PDF output. */}
        <div className="print-letterhead hidden items-center justify-between pb-4 mb-4 border-b-2 border-accent">
          <div className="flex items-center gap-3">
            {/* The PNG already carries a rounded-rect Haseeela mark with its own
                white margin baked in (the asset is RGB, not transparent). For
                print we therefore render it *as-is* without any wrapper box —
                no white-on-white floating square, no ring, no clipping of the
                rounded corners. The intentional padding is part of the asset. */}
            <Image
              src="/haseeela_icon.png"
              alt={`${t('brand.name')} logo`}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0"
              priority
            />
            <div>
              <div className="text-[20px] brand-wordmark">{t('brand.name')}</div>
              <div className="text-[11px] text-text-muted">{t('reports.ui.freelanceFinanceReport')}</div>
            </div>
          </div>
          <div className={`text-${dir === 'rtl' ? 'left' : 'right'}`}>
            <div className="text-[14px] font-semibold">{report?.title || t('reports.ui.fallbackReport')}</div>
            <div className="text-[11px] text-text-muted tnum"><span className="date-token">{from}</span> &rarr; <span className="date-token">{to}</span></div>
            <div className="text-[11px] text-text-muted">{t('reports.ui.generated', { date: formatDate(new Date(), locale) })}</div>
          </div>
        </div>

        <Card pad={0}>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="t-h3">{report?.title || t('reports.ui.fallbackReport')}</div>
              <div className="t-small text-text-muted tnum"><span className="date-token">{from}</span> &rarr; <span className="date-token">{to}</span></div>
            </div>
          </div>

          {/* Summary */}
          {report && report.summary.length > 0 && (
            <div className="px-5 py-4 border-b border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
              {report.summary.map((s) => {
                const isNumericInt = Number.isInteger(s.value) && Math.abs(s.value) < 1000 && !String(s.label).match(/revenue|net|profit|expenses/i);
                return (
                  <div key={s.label}>
                    <div className="t-caption text-text-muted">{s.label}</div>
                    <div className={`t-h3 tnum ${s.tone === 'positive' ? 'text-positive' : s.tone === 'negative' ? 'text-negative' : ''}`}>
                      {isNumericInt ? s.value : money.format(s.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="p-5 flex flex-col gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : !report || report.rows.length === 0 ? (
            <div className="py-14 text-center text-text-muted">
              <Icon name="fileBarChart" size={32} className="mx-auto mb-3 opacity-50" />
              <p className="t-body">{t('reports.ui.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                <thead>
                  <tr className="border-b border-border">
                    {report.columns.map((c) => (
                      <th key={c.key} className={`px-5 py-2.5 t-caption text-text-muted ${c.numeric ? (dir === 'rtl' ? 'text-left' : 'text-right') : ''}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {row.map((cell, j) => {
                        const col = report.columns[j];
                        const isNeg = col.numeric && typeof cell === 'number' && cell < 0;
                        const isPos = col.numeric && typeof cell === 'number' && cell > 0 && (col.key === 'revenue' || col.key === 'amount' || col.key === 'net');
                        return (
                          <td key={j} className={`px-5 py-2.5 t-body ${col.numeric ? (dir === 'rtl' ? 'text-left tnum' : 'text-right tnum') : ''} ${isNeg ? 'text-negative' : isPos ? 'text-positive' : ''}`}>
                            {fmtCell(cell, col.numeric)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
