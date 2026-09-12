'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useFinancialStore } from '@/store/useFinancialStore';
import {
  selectPendingPayments,
  selectPendingTotal,
  selectPendingCount,
  daysOverdue,
} from '@/selectors/financialSelectors';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  SectionHeader,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { makeCompactCurrencyFormatter } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { useLocale, translateError } from '@/lib/i18n';
import { latinTokenClass } from '@/lib/textDirection';
import { Transaction, Client } from '@/types/finance';

const getTodayKey = () => new Date().toISOString().slice(0, 10);

function useModalA11y(isOpen: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
          focusable[0].focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  return modalRef;
}

interface PendingPaymentFormModalProps {
  isOpen: boolean;
  existing?: Transaction | null;
  clients: Client[];
  currencyPrefix: string;
  onClose: () => void;
  onSave: (data: { clientId: string; amount: number; expectedDate: string; note?: string }, existingId?: string) => Promise<void>;
}

function PendingPaymentFormModal({
  isOpen,
  existing,
  clients,
  currencyPrefix,
  onClose,
  onSave,
}: PendingPaymentFormModalProps) {
  const { t } = useLocale();
  const modalRef = useModalA11y(isOpen, onClose);

  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedDate, setExpectedDate] = useState(getTodayKey());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [touched, setTouched] = useState({
    clientId: false,
    amount: false,
    expectedDate: false,
    note: false,
  });

  useEffect(() => {
    if (isOpen) {
      if (existing) {
        setClientId(existing.clientId || existing.sourceId || '');
        setAmount(String(existing.amount || ''));
        setExpectedDate((existing.expectedDate || existing.date || getTodayKey()).slice(0, 10));
        setNote(existing.notes || '');
      } else {
        setClientId('');
        setAmount('');
        setExpectedDate(getTodayKey());
        setNote('');
      }
      setTouched({ clientId: false, amount: false, expectedDate: false, note: false });
      setServerError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, existing]);

  const activeClients = useMemo(() => {
    return clients.filter((c) => !c.archivedAt || (existing && c.id === (existing.clientId || existing.sourceId)));
  }, [clients, existing]);

  const errors = useMemo(() => {
    const errs: { clientId?: string; amount?: string; expectedDate?: string; note?: string } = {};
    if (!clientId.trim()) {
      errs.clientId = t('pending.form.errorClient');
    }
    const num = parseFloat(amount);
    if (!amount.trim() || isNaN(num) || num <= 0) {
      errs.amount = t('pending.form.errorAmount');
    }
    if (!expectedDate.trim() || isNaN(Date.parse(expectedDate))) {
      errs.expectedDate = t('pending.form.errorDate');
    }
    if (note.length > 500) {
      errs.note = t('pending.form.errorNote');
    }
    return errs;
  }, [clientId, amount, expectedDate, note, t]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ clientId: true, amount: true, expectedDate: true, note: true });

    if (hasErrors) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      await onSave(
        {
          clientId: clientId.trim(),
          amount: parseFloat(amount),
          expectedDate,
          note: note.trim() || undefined,
        },
        existing?.id
      );
      onClose();
    } catch (err: any) {
      setServerError(err?.message || 'Failed to save pending payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-4"
      onMouseDown={() => !isSubmitting && onClose()}
    >
      <Card
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-form-modal-title"
        className="w-full max-w-[520px] max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-8"
        pad={24}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h2 id="pending-form-modal-title" className="t-h3">
              {existing ? t('pending.form.editTitle') : t('pending.form.addTitle')}
            </h2>
            <p className="text-sm text-text-muted mt-1">{t('pending.form.subtitle')}</p>
          </div>

          {serverError && <InlineAlert tone="negative">{translateError(serverError, t)}</InlineAlert>}

          <Field label={t('pending.form.clientLabel')} error={touched.clientId ? errors.clientId : undefined}>
            <Select
              name="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, clientId: true }))}
              error={!!(touched.clientId && errors.clientId)}
              disabled={isSubmitting}
            >
              <option value="">{t('pending.form.selectClient')}</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('pending.form.amountLabel')} error={touched.amount ? errors.amount : undefined}>
              <Input
                name="amount"
                type="number"
                step="any"
                min="0.01"
                prefix={<span dir="ltr">{currencyPrefix}</span>}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, amount: true }))}
                error={!!(touched.amount && errors.amount)}
                disabled={isSubmitting}
                required
              />
            </Field>

            <Field label={t('pending.form.expectedDateLabel')} error={touched.expectedDate ? errors.expectedDate : undefined}>
              <Input
                name="expectedDate"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, expectedDate: true }))}
                error={!!(touched.expectedDate && errors.expectedDate)}
                disabled={isSubmitting}
                required
              />
            </Field>
          </div>

          <Field
            label={t('pending.form.noteLabel')}
            hint={<span dir="ltr">{`${note.length}/500`}</span>}
            error={touched.note ? errors.note : undefined}
          >
            <Textarea
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, note: true }))}
              maxLength={500}
              placeholder={t('pending.form.notePlaceholder')}
              error={!!(touched.note && errors.note)}
              disabled={isSubmitting}
            />
          </Field>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onClose}>
              {t('pending.form.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? t('pending.form.saving') : existing ? t('pending.form.save') : t('pending.form.create')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface MarkAsPaidModalProps {
  isOpen: boolean;
  payment: Transaction | null;
  clientName: string;
  formattedAmount: string;
  onClose: () => void;
  onConfirm: (paymentId: string, completedDate: string) => Promise<void>;
}

function MarkAsPaidModal({
  isOpen,
  payment,
  clientName,
  formattedAmount,
  onClose,
  onConfirm,
}: MarkAsPaidModalProps) {
  const { t } = useLocale();
  const modalRef = useModalA11y(isOpen, onClose);

  const [completedDate, setCompletedDate] = useState(getTodayKey());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCompletedDate(getTodayKey());
      setIsSubmitting(false);
      setServerError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!payment) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      await onConfirm(payment.id, completedDate || getTodayKey());
      onClose();
    } catch (err: any) {
      setServerError(err?.message || 'Failed to complete payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !payment) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-4"
      onMouseDown={() => !isSubmitting && onClose()}
    >
      <Card
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-as-paid-title"
        className="w-full max-w-[460px] shadow-xl my-8"
        pad={24}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div>
            <h2 id="mark-as-paid-title" className="t-h3">
              {t('pending.confirmPaid.title')}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {t('pending.confirmPaid.desc', {
                client: <span className={`font-medium text-text ${latinTokenClass(clientName)}`}>{clientName}</span>,
              })}
            </p>
          </div>

          <div className="rounded-md bg-surface-hover border border-border p-3 flex items-center justify-between">
            <span className="text-sm text-text-muted">{t('pending.confirmPaid.amount')}</span>
            <span dir="ltr" className="t-h3 font-semibold text-text tnum">
              {formattedAmount}
            </span>
          </div>

          <Field label={t('pending.confirmPaid.completionDateLabel')}>
            <Input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </Field>

          {serverError && <InlineAlert tone="negative">{translateError(serverError, t)}</InlineAlert>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onClose}>
              {t('pending.confirmPaid.cancel')}
            </Button>
            <Button type="button" variant="primary" loading={isSubmitting} disabled={isSubmitting} onClick={handleConfirm}>
              {isSubmitting ? t('pending.confirmPaid.confirming') : t('pending.confirmPaid.confirm')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function PendingPaymentsSection() {
  const {
    clients,
    transactions,
    currency,
    addPendingPayment,
    updatePendingPayment,
    deletePendingPayment,
    completePendingPayment,
    revertPendingPayment,
  } = useFinancialStore();

  const { t, locale } = useLocale();
  const { toast } = useToast();

  const money = useMemo(
    () => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 2 }, locale),
    [currency, locale]
  );
  const currencyPrefix = useMemo(
    () => money.formatToParts(0).find((part) => part.type === 'currency')?.value || currency,
    [currency, money]
  );

  const pendingPayments = useMemo(() => selectPendingPayments(transactions), [transactions]);
  const pendingTotal = useMemo(() => selectPendingTotal(transactions), [transactions]);
  const pendingCount = useMemo(() => selectPendingCount(transactions), [transactions]);

  // Clients lookup map
  const clientsMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  // Sorting: overdue first (most overdue at top), then by expected date ascending
  const sortedPayments = useMemo(() => {
    return [...pendingPayments].sort((a, b) => {
      const overdueA = daysOverdue(a);
      const overdueB = daysOverdue(b);
      const isOverdueA = overdueA > 0;
      const isOverdueB = overdueB > 0;

      if (isOverdueA && isOverdueB) {
        if (overdueB !== overdueA) return overdueB - overdueA;
        const timeA = new Date(a.expectedDate || a.date).getTime();
        const timeB = new Date(b.expectedDate || b.date).getTime();
        return timeA - timeB;
      }
      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;

      const timeA = new Date(a.expectedDate || a.date).getTime();
      const timeB = new Date(b.expectedDate || b.date).getTime();
      return timeA - timeB;
    });
  }, [pendingPayments]);

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Transaction | null>(null);

  const [markPaidTarget, setMarkPaidTarget] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenAddModal = () => {
    setEditingPayment(null);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingPayment(tx);
    setFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setFormModalOpen(false);
    setEditingPayment(null);
  };

  const handleSavePayment = async (
    data: { clientId: string; amount: number; expectedDate: string; note?: string },
    existingId?: string
  ) => {
    if (existingId) {
      await updatePendingPayment(existingId, {
        amount: data.amount,
        expectedDate: data.expectedDate,
        note: data.note,
      });
      toast(t('pending.toast.updated'), 'success');
    } else {
      await addPendingPayment(data);
      toast(t('pending.toast.created'), 'success');
    }
  };

  const handleConfirmMarkAsPaid = async (paymentId: string, completedDate: string) => {
    await completePendingPayment(paymentId, completedDate);
    toast(t('pending.toast.completed'), {
      tone: 'success',
      action: {
        label: t('pending.toast.undo'),
        onClick: async () => {
          try {
            await revertPendingPayment(paymentId);
            toast(t('pending.toast.reverted'), 'info');
          } catch {
            toast(t('pending.toast.revertFailed'), 'error');
          }
        },
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePendingPayment(deleteTarget.id);
      setDeleteTarget(null);
      toast(t('pending.toast.deleted'), 'success');
    } finally {
      setIsDeleting(false);
    }
  };

  const markPaidClient = markPaidTarget
    ? clientsMap.get(markPaidTarget.clientId || '') || (markPaidTarget.sourceId ? clientsMap.get(markPaidTarget.sourceId) : undefined)
    : null;
  const markPaidClientName = markPaidClient?.name || markPaidTarget?.name || '';

  const subText = useMemo(() => {
    const formattedTotal = <span dir="ltr">{money.format(pendingTotal)}</span>;
    return pendingCount === 1
      ? t('pending.section.subtitle', { count: 1, amount: formattedTotal })
      : t('pending.section.subtitlePlural', { count: pendingCount, amount: formattedTotal });
  }, [pendingCount, pendingTotal, money, t]);

  return (
    <div id="pending" className="scroll-mt-6">
      <Card pad={0} className="overflow-hidden">
        {pendingCount === 0 ? (
          <div className="p-4 sm:p-5">
            <SectionHeader
              title={t('pending.section.title')}
              action={
                <Button variant="primary" size="sm" icon="plus" onClick={handleOpenAddModal}>
                  {t('pending.actions.add')}
                </Button>
              }
              className="mb-0"
            />
            <EmptyState
              icon="clock"
              title={t('pending.empty.title')}
              body={t('pending.empty.description')}
              action={
                <Button variant="primary" icon="plus" onClick={handleOpenAddModal}>
                  {t('pending.actions.add')}
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-5 border-b border-border flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <SectionHeader
                title={t('pending.section.title')}
                sub={subText}
                className="mb-0"
              />
              <Button variant="primary" size="sm" icon="plus" onClick={handleOpenAddModal} className="w-full sm:w-auto">
                {t('pending.actions.add')}
              </Button>
            </div>

            <div className="divide-y divide-border">
              {sortedPayments.map((tx) => {
                const client = clientsMap.get(tx.clientId || '') || (tx.sourceId ? clientsMap.get(tx.sourceId) : undefined);
                const clientName = client?.name || tx.name;
                const overdue = daysOverdue(tx);
                const isOverdue = overdue > 0;
                const expectedDateStr = (tx.expectedDate || tx.date).slice(0, 10);

                return (
                  <div
                    key={tx.id}
                    className="p-4 flex flex-col gap-3 hover:bg-surface-hover transition-colors sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Left: Avatar + Name + Note */}
                    <div className="flex items-start gap-3 min-w-0 sm:items-center">
                      <Avatar name={clientName} size={36} color="--viz-2" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`t-body-m font-medium text-text ${latinTokenClass(clientName)}`}>
                            {clientName}
                          </span>
                          {isOverdue && (
                            <Badge tone={overdue > 14 ? 'negative' : 'warning'} icon="alertTriangle">
                              {overdue === 1
                                ? t('pending.badge.overdue', { days: 1 })
                                : t('pending.badge.overduePlural', { days: overdue })}
                            </Badge>
                          )}
                        </div>
                        {tx.notes && (
                          <p className="t-small text-text-muted truncate max-w-sm mt-0.5" title={tx.notes}>
                            {tx.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Expected date + Amount + Actions */}
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-start sm:text-end">
                        <div className="t-h3 font-semibold text-text tnum" dir="ltr">
                          {money.format(tx.amount)}
                        </div>
                        <div className="t-small text-text-muted mt-0.5">
                          <span dir="ltr" className="date-token">
                            {formatDate(expectedDateStr, locale)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          icon="check"
                          onClick={() => setMarkPaidTarget(tx)}
                        >
                          {t('pending.actions.markAsPaid')}
                        </Button>
                        <IconButton
                          icon="pencil"
                          size="sm"
                          className="min-w-[44px] min-h-[44px]"
                          title={t('pending.actions.edit')}
                          aria-label={t('pending.actions.edit')}
                          onClick={() => handleOpenEditModal(tx)}
                        />
                        <IconButton
                          icon="trash2"
                          size="sm"
                          className="min-w-[44px] min-h-[44px] text-negative-text hover:text-negative-text"
                          title={t('pending.actions.delete')}
                          aria-label={t('pending.actions.delete')}
                          onClick={() => setDeleteTarget(tx)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Add / Edit Form Modal */}
      <PendingPaymentFormModal
        isOpen={formModalOpen}
        existing={editingPayment}
        clients={clients}
        currencyPrefix={currencyPrefix}
        onClose={handleCloseFormModal}
        onSave={handleSavePayment}
      />

      {/* Mark As Paid Modal */}
      <MarkAsPaidModal
        isOpen={!!markPaidTarget}
        payment={markPaidTarget}
        clientName={markPaidClientName}
        formattedAmount={markPaidTarget ? money.format(markPaidTarget.amount) : ''}
        onClose={() => setMarkPaidTarget(null)}
        onConfirm={handleConfirmMarkAsPaid}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title={t('pending.delete.title')}
        description={t('pending.delete.description')}
        impact={t('pending.delete.cannotBeUndone')}
        tone="danger"
        confirmLabel={isDeleting ? t('pending.delete.deleting') : t('pending.delete.confirm')}
        cancelLabel={t('pending.delete.cancel')}
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
