'use client';

import { useEffect, useState } from 'react';
import { useInvoiceStore } from '@/store/invoiceStore';
import { downloadInvoicePdf, InvoiceSendError } from '@/services/financialApi';
import { formatCurrency } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/locales';
import type { Invoice } from '@/types/finance';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Form';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Icon } from '@/components/ui/Icon';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendableInvoice = {
  id: string;
  number: string;
  currency: string;
  total: number;
  dueDate: string;
  client?: { name?: string | null; email?: string | null } | null;
};

const money = (n: number, currency: string, locale: Locale) => {
  try {
    return formatCurrency(n, currency || 'USD', locale, { minimumFractionDigits: 2 });
  } catch {
    return String(n);
  }
};

export function SendInvoiceModal({
  open,
  onClose,
  invoice,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  invoice: SendableInvoice;
  onSent?: (updated: Invoice) => void;
}) {
  const { send } = useInvoiceStore();
  const { t, locale } = useLocale();
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'form' | 'success' | 'fallback'>('form');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');

  // Reset + prefill whenever the modal opens.
  useEffect(() => {
    if (open) {
      setTo(invoice.client?.email || '');
      setMessage('');
      setView('form');
      setSending(false);
      setError(null);
    }
  }, [open, invoice.client?.email]);

  const emailValid = EMAIL_RE.test(to.trim());

  const triggerBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      const { blob, filename } = await downloadInvoicePdf(invoice.id);
      triggerBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('invoices.send.errorDownload'));
    } finally {
      setDownloading(false);
    }
  };

  const mailtoHref = () => {
    const subject = t('invoices.send.emailSubject').replace('{number}', invoice.number);
    const bodyTemplate = t('invoices.send.emailBody')
      .replace('{number}', invoice.number)
      .replace('{amount}', money(invoice.total, invoice.currency, locale))
      .replace('{date}', invoice.dueDate);
    const body = (message.trim() ? `${message.trim()}\n\n` : '') + bodyTemplate;
    return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const submit = async () => {
    setError(null);
    if (!emailValid) {
      setError(t('invoices.send.errorInvalidEmail'));
      return;
    }
    setSending(true);
    try {
      const result = await send(invoice.id, { to: to.trim(), message: message.trim() || undefined });
      setSentTo(result.sentTo || to.trim());
      onSent?.(result.invoice);
      setView('success');
    } catch (e) {
      if (e instanceof InvoiceSendError && e.code === 'smtp_not_configured') {
        setView('fallback');
        return;
      }
      setError(e instanceof Error ? e.message : t('invoices.send.errorSend'));
    } finally {
      setSending(false);
    }
  };

  // ── Success ──
  if (view === 'success') {
    return (
      <Modal open={open} onClose={onClose} title={t('invoices.send.successTitle')} maxWidth={460}>
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="w-12 h-12 rounded-full bg-positive-tint text-positive-text flex items-center justify-center">
            <Icon name="checkCircle" size={24} />
          </div>
          <p className="t-body text-text-secondary">
            {t('invoices.send.successMessagePart1')}
            <span dir="ltr">{invoice.number}</span>
            {t('invoices.send.successMessagePart2')}
            <span className="text-text font-medium" dir="ltr">{sentTo}</span>
            {t('invoices.send.successMessagePart3')}
          </p>
          <Button className="w-full mt-2" onClick={onClose}>{t('invoices.send.done')}</Button>
        </div>
      </Modal>
    );
  }

  // ── SMTP-not-configured fallback ──
  if (view === 'fallback') {
    return (
      <Modal open={open} onClose={onClose} title={t('invoices.send.fallbackTitle')} maxWidth={480}>
        <div className="flex flex-col gap-4">
          <InlineAlert tone="warning" title={t('invoices.send.fallbackAlertTitle')} body={t('invoices.send.fallbackAlertBody')} />
          {error && <InlineAlert tone="negative" body={error} />}
          <div className="flex flex-col gap-2">
            <Button icon="download" loading={downloading} onClick={downloadPdf} className="w-full">
              {t('invoices.send.downloadPdf')}
            </Button>
            <a href={mailtoHref()} className="w-full">
              <Button variant="secondary" icon="send" className="w-full">{t('invoices.send.openEmailApp')}</Button>
            </a>
          </div>
          <p className="t-small text-text-muted" dir="auto">
            {t('invoices.send.fallbackHint')}
          </p>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={onClose}>{t('invoices.send.close')}</Button>
        </div>
      </Modal>
    );
  }

  // ── Form ──
  return (
    <Modal
      open={open}
      onClose={() => !sending && onClose()}
      title={t('invoices.send.modalTitle').replace('{number}', invoice.number)}
      description={t('invoices.send.modalDesc').replace('{amount}', money(invoice.total, invoice.currency, locale)).replace('{date}', invoice.dueDate)}
      dismissable={!sending}
      maxWidth={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>{t('invoices.send.cancel')}</Button>
          <Button icon="send" loading={sending} disabled={!emailValid} onClick={submit}>{t('invoices.send.sendInvoice')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <InlineAlert tone="negative" title={t('invoices.send.errorModalTitle')} body={error} />}
        <Field label={t('invoices.send.recipientEmail')} error={to.length > 0 && !emailValid ? t('invoices.send.errorEmailHint') : undefined}>
          <Input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t('invoices.send.emailPlaceholder')}
            dir="ltr"
            style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
            autoFocus
          />
        </Field>
        <Field label={t('invoices.send.messageLabel')} hint={t('invoices.send.messageHint')}>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('invoices.send.emailMessagePlaceholder').replace('{name}', invoice.client?.name || (locale === 'ar' ? 'هناك' : 'there'))}
          />
        </Field>
        <p className="t-small text-text-muted">
          {t('invoices.send.footerHintPart1')}
          <span className="font-medium">{t('invoices.send.footerHintPart2')}</span>
          {t('invoices.send.footerHintPart3')}
        </p>
      </div>
    </Modal>
  );
}

