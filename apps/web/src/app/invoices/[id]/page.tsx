'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useInvoiceStore } from '@/store/invoiceStore';
import { InvoiceStatus } from '@/types/finance';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/locales';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument';
import { SendInvoiceModal } from '@/components/invoices/SendInvoiceModal';

const statusTone = (s: InvoiceStatus) =>
  s === 'PAID' ? 'positive' : s === 'OVERDUE' ? 'negative' : s === 'SENT' ? 'info' : 'neutral';
const fmtDate = (v: string | null | undefined, locale: Locale) => (v ? formatDate(v, locale, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useLocale();
  const id = String(params.id);
  const { isLoaded, loadInvoices, getInvoice, markPaid, deleteInvoice } = useInvoiceStore();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded) loadInvoices();
  }, [isLoaded, loadInvoices]);

  const invoice = getInvoice(id);

  // Opened from the editor's "Create & send" → launch the Send modal once.
  useEffect(() => {
    if (invoice && invoice.status !== 'PAID' && searchParams.get('send') === '1') {
      setSendOpen(true);
      window.history.replaceState(null, '', `/invoices/${id}`);
    }
  }, [invoice, searchParams, id]);

  if (!isLoaded) return <div className="py-24 text-center text-text-muted text-[13px]">{t('invoices.loading')}</div>;
  if (!invoice) {
    return (
      <div className="py-24 text-center">
        <p className="t-body text-text-muted">{t('invoices.notFound')}</p>
        <button onClick={() => router.push('/invoices')} className="mt-3 t-body-m text-accent hover:underline">{t('invoices.back')}</button>
      </div>
    );
  }

  const run = async (label: string, fn: () => Promise<void>, success: string) => {
    setBusy(label);
    try {
      await fn();
      toast(success);
    } catch (e) {
      toast(e instanceof Error ? e.message : t('invoices.detail.actionFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const STATUS_LABELS: Record<InvoiceStatus, string> = {
    DRAFT: t('invoices.status.draft'),
    SENT: t('invoices.status.sent'),
    PAID: t('invoices.status.paid'),
    OVERDUE: t('invoices.status.overdue'),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <IconButton icon="arrowLeft" title={t('invoices.detail.back')} onClick={() => router.push('/invoices')} />
        <h1 className="t-h1" dir="ltr">{invoice.number}</h1>
        <Badge tone={statusTone(invoice.status)}>{STATUS_LABELS[invoice.status as InvoiceStatus] || (invoice.status[0] + invoice.status.slice(1).toLowerCase())}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <InvoiceDocument
          data={{
            number: invoice.number,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            clientName: invoice.client?.name,
            clientCompany: invoice.client?.company,
            clientEmail: invoice.client?.email,
            lineItems: invoice.lineItems.map((li) => ({ description: li.description, quantity: li.quantity, rate: li.rate })),
            taxRate: invoice.taxRate,
            discount: invoice.discount,
            notes: invoice.notes,
            terms: invoice.terms,
          }}
        />

        {/* Side panel (hidden on print) */}
        <div className="flex flex-col gap-4 print:hidden">
          <Card pad={18} className="flex flex-col gap-3">
            <div className="t-caption text-text-muted">{t('invoices.detail.statusLabel')}</div>
            <Badge tone={statusTone(invoice.status)} className="self-start">{STATUS_LABELS[invoice.status as InvoiceStatus] || (invoice.status[0] + invoice.status.slice(1).toLowerCase())}</Badge>
            <div className="flex justify-between t-small"><span className="text-text-muted">{t('invoices.detail.issuedLabel')}</span><span className="tnum date-token">{fmtDate(invoice.issueDate, locale)}</span></div>
            <div className="flex justify-between t-small"><span className="text-text-muted">{t('invoices.detail.dueLabel')}</span><span className="tnum date-token">{fmtDate(invoice.dueDate, locale)}</span></div>
            {invoice.paidAt && <div className="flex justify-between t-small"><span className="text-text-muted">{t('invoices.detail.paidLabel')}</span><span className="tnum text-positive-text date-token">{fmtDate(invoice.paidAt, locale)}</span></div>}
            {invoice.client && <div className="flex justify-between t-small"><span className="text-text-muted">{t('invoices.detail.clientLabel')}</span><span dir="ltr">{invoice.client.name}</span></div>}
          </Card>

          <Card pad={18} className="flex flex-col gap-2">
            {invoice.status !== 'PAID' && (
              <Button icon="checkCircle" className="w-full" loading={busy === 'paid'} onClick={() => run('paid', () => markPaid(invoice.id), t('invoices.detail.toastMarkedPaid'))}>
                {t('invoices.detail.markPaid')}
              </Button>
            )}
            {invoice.status !== 'PAID' && (
              <Button variant="secondary" icon="send" className="w-full" onClick={() => setSendOpen(true)}>
                {invoice.status === 'SENT' ? t('invoices.detail.resend') : t('invoices.detail.send')}
              </Button>
            )}
            {invoice.status !== 'PAID' && (
              <Button variant="secondary" icon="pencil" className="w-full" onClick={() => router.push(`/invoices/${invoice.id}/edit`)}>{t('invoices.detail.edit')}</Button>
            )}
            <Button variant="secondary" icon="download" className="w-full" onClick={() => window.print()}>{t('invoices.detail.download')}</Button>
            <Button variant="ghost" icon="trash2" className="w-full text-negative-text" onClick={() => setConfirmDel(true)}>{t('invoices.detail.delete')}</Button>
          </Card>
        </div>
      </div>

      <SendInvoiceModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        invoice={{
          id: invoice.id,
          number: invoice.number,
          currency: invoice.currency,
          total: invoice.total,
          dueDate: fmtDate(invoice.dueDate, locale),
          client: invoice.client,
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        onClose={() => busy === null && setConfirmDel(false)}
        tone="danger"
        title={t('invoices.detail.deleteTitle')}
        description={t('invoices.detail.deleteDesc').replace('{number}', invoice.number)}
        confirmLabel={t('invoices.detail.deleteConfirm')}
        loading={busy === 'del'}
        onConfirm={() => run('del', async () => { await deleteInvoice(invoice.id); router.push('/invoices'); }, t('invoices.detail.toastDeleted'))}
      />
    </div>
  );
}
