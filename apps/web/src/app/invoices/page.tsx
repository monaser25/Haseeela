'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useFinancialStore } from '@/store/financialStore';
import { Invoice, InvoiceStatus } from '@/types/finance';
import { makeCompactCurrencyFormatter, makeLongCurrencyFormatter } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/locales';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge, FilterChip } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';

const statusTone = (s: InvoiceStatus) =>
  s === 'PAID' ? 'positive' : s === 'OVERDUE' ? 'negative' : s === 'SENT' ? 'info' : 'neutral';

const fmtDate = (v: string, locale: Locale) => formatDate(v, locale, { month: 'short', day: 'numeric', year: 'numeric' });

export default function InvoicesPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { invoices, isLoaded, isLoading, error, loadInvoices, deleteInvoice, markPaid } = useInvoiceStore();
  const selectedCurrency = useFinancialStore((s) => s.currency);
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  const STATUS_FILTERS: { id: 'all' | InvoiceStatus; label: string }[] = useMemo(() => [
    { id: 'all', label: t('invoices.status.all') },
    { id: 'DRAFT', label: t('invoices.status.draft') },
    { id: 'SENT', label: t('invoices.status.sent') },
    { id: 'PAID', label: t('invoices.status.paid') },
    { id: 'OVERDUE', label: t('invoices.status.overdue') },
  ], [t]);

  useEffect(() => {
    if (!isLoaded) loadInvoices();
  }, [isLoaded, loadInvoices]);

  const summary = useMemo(() => {
    const now = new Date();
    let outstanding = 0;
    let overdue = 0;
    let paidThisMonth = 0;
    for (const inv of invoices) {
      if (inv.status === 'SENT') outstanding += inv.total;
      if (inv.status === 'OVERDUE') { outstanding += inv.total; overdue += inv.total; }
      if (inv.status === 'PAID' && inv.paidAt) {
        const d = new Date(inv.paidAt);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) paidThisMonth += inv.total;
      }
    }
    return { outstanding, overdue, paidThisMonth };
  }, [invoices]);

  // Summary cards format in the currency of existing invoices, falling back to
  // the user's selected app currency so an empty list still reflects their choice.
  const baseCurrency = invoices[0]?.currency || selectedCurrency;
  // Spacious summary cards use the full localized currency name.
  const money0 = useMemo(() => makeLongCurrencyFormatter(baseCurrency, { maximumFractionDigits: 0 }, locale), [baseCurrency, locale]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: invoices.length };
    for (const f of STATUS_FILTERS) if (f.id !== 'all') counts[f.id] = invoices.filter((i) => i.status === f.id).length;
    return counts;
  }, [invoices, STATUS_FILTERS]);

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);

  const onMarkPaid = async (inv: Invoice) => {
    setBusy(true);
    try {
      await markPaid(inv.id);
      toast(t('invoices.toast.markedPaid').replace('{number}', inv.number));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('invoices.toast.failedMarkPaid'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onSend = (inv: Invoice) => setSendTarget(inv);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteInvoice(deleting.id);
      toast(t('invoices.toast.deleted').replace('{number}', deleting.number));
      setDeleting(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : t('invoices.toast.failedDelete'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">{t('invoices.title')}</h1>
          <p className="t-body text-text-muted mt-1">{t('invoices.subtitle')}</p>
        </div>
        <Button icon="plus" onClick={() => router.push('/invoices/new')}>{t('invoices.newInvoice')}</Button>
      </div>

      {error && <InlineAlert tone="negative" title={t('invoices.error.loadTitle')} body={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('invoices.summary.outstanding')} value={money0.format(summary.outstanding)} icon="clock" />
        <StatCard label={t('invoices.summary.overdue')} value={money0.format(summary.overdue)} tone={summary.overdue > 0 ? 'negative' : 'neutral'} icon="alertTriangle" />
        <StatCard label={t('invoices.summary.paidThisMonth')} value={money0.format(summary.paidThisMonth)} tone="positive" icon="checkCircle" />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} count={filterCounts[f.id]} onClick={() => setFilter(f.id as 'all' | InvoiceStatus)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      <Card pad={0}>
        {isLoading && !isLoaded ? (
          <div className="p-5 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="fileText"
            title={invoices.length === 0 ? t('invoices.empty.noInvoicesTitle') : t('invoices.empty.noMatchTitle')}
            body={invoices.length === 0 ? t('invoices.empty.noInvoicesBody') : t('invoices.empty.noMatchBody')}
            action={invoices.length === 0 ? <Button icon="plus" onClick={() => router.push('/invoices/new')}>{t('invoices.newInvoice')}</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('invoices.table.invoice')}</Th>
                  <Th>{t('invoices.table.client')}</Th>
                  <Th>{t('invoices.table.issued')}</Th>
                  <Th>{t('invoices.table.due')}</Th>
                  <Th>{t('invoices.table.status')}</Th>
                  <Th align="right">{t('invoices.table.amount')}</Th>
                  <Th align="right">{t('invoices.table.actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const money = makeCompactCurrencyFormatter(inv.currency, { minimumFractionDigits: 2 }, locale);
                  const statusLabel = STATUS_FILTERS.find(f => f.id === inv.status)?.label || (inv.status[0] + inv.status.slice(1).toLowerCase());
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <td className="px-4 py-3 t-body-m" dir="ltr">{inv.number}</td>
                      <td className="px-4 py-3 text-text-secondary" dir="ltr">{inv.client?.name || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary tnum"><span className="date-token">{fmtDate(inv.issueDate, locale)}</span></td>
                      <td className={`px-4 py-3 tnum ${inv.status === 'OVERDUE' ? 'text-negative-text' : 'text-text-secondary'}`}><span className="date-token">{fmtDate(inv.dueDate, locale)}</span></td>
                      <td className="px-4 py-3"><Badge tone={statusTone(inv.status)}>{statusLabel}</Badge></td>
                      <td className="px-4 py-3 text-right t-body-m tnum" dir="ltr">{money.format(inv.total)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <Menu
                            align="right"
                            trigger={<IconButton icon="moreHorizontal" size="sm" title={t('invoices.table.actions')} />}
                            items={[
                              { icon: 'eye', label: t('invoices.actions.view'), onClick: () => router.push(`/invoices/${inv.id}`) },
                              { icon: 'pencil', label: t('invoices.actions.edit'), onClick: () => router.push(`/invoices/${inv.id}/edit`), disabled: inv.status === 'PAID' },
                              ...(inv.status !== 'PAID' ? [{ icon: 'send', label: inv.status === 'SENT' ? t('invoices.actions.resend') : t('invoices.actions.send'), onClick: () => onSend(inv) }] : []),
                              ...(inv.status !== 'PAID' ? [{ icon: 'checkCircle', label: t('invoices.actions.markPaid'), onClick: () => onMarkPaid(inv) }] : []),
                              { divider: true },
                              { icon: 'trash2', label: t('invoices.actions.delete'), onClick: () => setDeleting(inv), danger: true },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        tone="danger"
        title={t('invoices.deleteDialog.title')}
        description={deleting ? t('invoices.deleteDialog.description').replace('{number}', deleting.number) : ''}
        confirmLabel={t('invoices.deleteDialog.confirm')}
        loading={busy}
        onConfirm={confirmDelete}
      />

      {sendTarget && (
        <SendInvoiceModal
          open={!!sendTarget}
          onClose={() => setSendTarget(null)}
          invoice={{
            id: sendTarget.id,
            number: sendTarget.number,
            currency: sendTarget.currency,
            total: sendTarget.total,
            dueDate: fmtDate(sendTarget.dueDate, locale),
            client: sendTarget.client,
          }}
        />
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-3 t-caption text-text-muted ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>
  );
}
