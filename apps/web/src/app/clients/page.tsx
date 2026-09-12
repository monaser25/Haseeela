'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeNextBillingDate } from '@/store/financialStore';
import { useFinancialStore } from '@/store/useFinancialStore';
import { getClientRevenue } from '@/selectors/financialSelectors';
import { Client } from '@/types/finance';
import { makeCompactCurrencyFormatter, makeLongCurrencyFormatter } from '@/lib/currency';
import { formatDate, formatTransactionName } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { latinTokenClass } from '@/lib/textDirection';
import { Avatar, Badge, Button, Card, EmptyState, Field, Icon, IconButton, InlineAlert, Input, SectionHeader, Select, StatCard } from '@/components/ui';
import { PendingPaymentsSection } from '@/components/PendingPayments';

type ModalState = { mode: 'add' } | { mode: 'edit'; client: Client } | null;
type DeleteTarget = { client: Client; transactionCount: number; revenueTotal: number } | null;

const ClientRevenuePieChart = dynamic(
  () => import('@/components/charts/ClientRevenuePieChart').then((mod) => mod.ClientRevenuePieChart),
  { ssr: false, loading: () => <div className="h-[210px]" /> },
);

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ClientsPage() {
  const { clients, transactions, currency, isInitialized, addClient, updateClient, deleteClient, deleteClientPermanently, recordClientPayment } = useFinancialStore();
  const { t, locale } = useLocale();
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingPermanent, setIsDeletingPermanent] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const money = useMemo(() => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale), [currency, locale]);
  const moneyWithCents = useMemo(() => makeCompactCurrencyFormatter(currency, undefined, locale), [currency, locale]);
  const moneyLong = useMemo(() => makeLongCurrencyFormatter(currency, undefined, locale), [currency, locale]);
  const currencyPrefix = useMemo(() => moneyWithCents.formatToParts(0).find((part) => part.type === 'currency')?.value || currency, [currency, moneyWithCents]);

  const openAddModal = () => { setModalError(null); setModal({ mode: 'add' }); };
  const openEditModal = (client: Client) => { setModalError(null); setModal({ mode: 'edit', client }); };
  const closeModal = () => { if (!isSaving) setModal(null); };
  const closeDeleteModal = () => { if (!isDeleting && !isDeletingPermanent) setDeleteTarget(null); };

  useEffect(() => {
    if (!isInitialized) return;
    const action = new URLSearchParams(window.location.search).get('action');
    if (action === 'client' || action === 'payment') {
      openAddModal();
      window.history.replaceState(null, '', '/clients');
    }
  }, [isInitialized]);

  const revenueForClient = useCallback((clientId: string) =>
    getClientRevenue(transactions, clientId), [transactions]);

  const transactionsForClient = useCallback((clientId: string) =>
    transactions.filter((tx) => tx.clientId === clientId || (tx.sourceType === 'client' && tx.sourceId === clientId)), [transactions]);

  const visibleClients = useMemo(
    () => clients.filter((client) => showArchived || !client.archivedAt),
    [clients, showArchived],
  );

  const chartData = useMemo(
    () => visibleClients.map((client) => ({ name: client.name, value: revenueForClient(client.id) })).filter((row) => row.value > 0),
    [revenueForClient, visibleClients],
  );
  const topClient = [...visibleClients].sort((a, b) => revenueForClient(b.id) - revenueForClient(a.id))[0];
  const clientStats = useMemo(() => ({
    active: clients.filter((client) => !client.archivedAt && client.status === 'ACTIVE').length,
    retainers: clients.filter((client) => !client.archivedAt && client.paymentType === 'retainer').length,
    recordedRevenue: clients.reduce((sum, client) => sum + revenueForClient(client.id), 0),
    archived: clients.filter((client) => client.archivedAt).length,
  }), [clients, revenueForClient]);

  const recordPayment = async (client: Client) => {
    setRecordingId(client.id);
    setActionError(null);
    try {
      await recordClientPayment(client.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to record client payment');
    } finally {
      setRecordingId(null);
    }
  };

  const saveClient = async (formData: FormData, existing?: Client) => {
    const paymentType = String(formData.get('paymentType')) as Client['paymentType'];
    const paymentDate = String(formData.get('paymentDate') || today());
    const revenue = Number(formData.get('revenue') || 0);

    const nextBillingDateFromForm = paymentType === 'retainer' ? String(formData.get('nextBillingDate') || '') || undefined : undefined;
    const safeBillingDay = nextBillingDateFromForm
      ? Math.max(1, Math.min(28, new Date(`${nextBillingDateFromForm}T12:00:00`).getDate()))
      : undefined;

    const base = {
      name: String(formData.get('name') || '').trim(),
      company: String(formData.get('company') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      revenue,
      clientType: String(formData.get('clientType') || 'COMPANY') as Client['clientType'],
      status: String(formData.get('status') || 'ACTIVE') as Client['status'],
      paymentType,
      paymentDate: paymentType === 'onetime' ? paymentDate : undefined,
      billingDay: safeBillingDay,
      nextBillingDate: nextBillingDateFromForm,
      recorded: existing?.recorded ?? false,
      updatedAt: new Date().toISOString(),
    };

    if (!base.name || revenue <= 0) return;

    setIsSaving(true);
    setModalError(null);
    try {
      if (existing) {
        await updateClient(existing.id, base);
      } else {
        await addClient({
          id: makeId(),
          ...base,
          createdAt: new Date().toISOString(),
        });
      }
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = (client: Client) => {
    const linkedTransactions = transactionsForClient(client.id);
    setModal(null);
    setDeleteError(null);
    setDeleteTarget({
      client,
      transactionCount: linkedTransactions.length,
      revenueTotal: linkedTransactions.filter((tx) => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0),
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteClient(deleteTarget.client.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete client');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeletePermanently = async () => {
    if (!deleteTarget) return;
    setIsDeletingPermanent(true);
    setDeleteError(null);
    try {
      await deleteClientPermanently(deleteTarget.client.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to permanently delete client');
    } finally {
      setIsDeletingPermanent(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="t-h1">{t('clients.title')}</h1>
            <p className="t-body mt-1 text-text-muted">{t('clients.subtitle')}</p>
          </div>
          <Button icon="Plus" onClick={openAddModal} className="w-full sm:w-auto">{t('clients.addClient')}</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('clients.stats.active')} value={clientStats.active} icon="Users" />
          <StatCard label={t('clients.stats.retainers')} value={clientStats.retainers} icon="Repeat" />
          <StatCard label={t('clients.stats.recordedRevenue')} value={money.format(clientStats.recordedRevenue)} tone="positive" icon="TrendingUp" />
          <StatCard label={t('clients.stats.archived')} value={clientStats.archived} icon="Archive" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
        <PendingPaymentsSection />
        <Card pad={0} className="overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <SectionHeader title={t('clients.book.title')} sub={visibleClients.length === 1 ? t('clients.book.shown', { count: String(visibleClients.length) }) : t('clients.book.shownPlural', { count: String(visibleClients.length) })} className="mb-0" />
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              <button type="button" onClick={() => setShowArchived(false)} className={`focus-ring h-8 px-3 rounded-full text-[13px] font-medium border transition-all ${!showArchived ? 'border-transparent bg-accent text-accent-fg' : 'border-border bg-surface hover:bg-surface-hover text-text-secondary'}`}>{t('clients.filters.active')}</button>
              <button type="button" onClick={() => setShowArchived(true)} className={`focus-ring h-8 px-3 rounded-full text-[13px] font-medium border transition-all ${showArchived ? 'border-transparent bg-accent text-accent-fg' : 'border-border bg-surface hover:bg-surface-hover text-text-secondary'}`}>{t('clients.filters.archived')}</button>
            </div>
          </div>
          {actionError && <div className="mx-4 mt-4 sm:mx-5"><InlineAlert tone="negative">{actionError}</InlineAlert></div>}

          {visibleClients.length === 0 ? (
            <EmptyState icon="Users" title={t('clients.empty.title')} body={t('clients.empty.body')} action={<Button icon="Plus" onClick={openAddModal}>{t('clients.addClient')}</Button>} />
          ) : (
            <div className="divide-y divide-border">
              {visibleClients.map((client) => {
                const clientTransactions = transactionsForClient(client.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const totalPaid = clientTransactions.filter((tx) => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0);
                return (
                <div key={client.id} className="p-4 flex flex-col gap-4 hover:bg-surface-hover transition-colors">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 sm:items-center">
                    <Avatar name={client.name} size={40} color="--viz-1" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`t-body-m text-text ${latinTokenClass(client.name)}`}>{client.name}</span>
                        <Badge tone={client.paymentType === 'retainer' ? 'accent' : 'positive'}>{client.paymentType === 'retainer' ? t('clients.badges.retainer') : t('clients.badges.onetime')}</Badge>
                        <Badge tone={client.status === 'ACTIVE' ? 'positive' : client.status === 'PROSPECT' ? 'warning' : 'neutral'}>{client.status === 'ACTIVE' ? t('clients.form.statusActive') : client.status === 'PROSPECT' ? t('clients.form.statusProspect') : client.status === 'COMPLETED' ? t('clients.form.statusCompleted') : t('clients.form.statusInactive')}</Badge>
                        {client.archivedAt && <Badge>{t('clients.badges.archived')}</Badge>}
                      </div>
                      <div className="text-sm text-text-muted mt-1">
                        {client.paymentType === 'retainer'
                        ? t('clients.payment.monthlyNext', { amount: <span dir="ltr">{money.format(client.revenue)}</span>, date: client.nextBillingDate ? <span className="date-token">{formatDate(client.nextBillingDate, locale)}</span> : t('clients.payment.notScheduled') })
                        : t('clients.payment.onetime', { amount: <span dir="ltr">{money.format(client.revenue)}</span>, date: client.paymentDate ? <span className="date-token">{formatDate(client.paymentDate, locale)}</span> : t('clients.payment.notScheduled') })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-mono font-semibold text-positive" dir="ltr">{money.format(totalPaid)}</div>
                      <div className="text-xs text-text-muted">{t('clients.payment.totalPaid')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {client.paymentType === 'retainer' && client.status === 'ACTIVE' && !client.archivedAt && (
                        <IconButton icon="DollarSign" size="sm" disabled={recordingId === client.id} onClick={() => recordPayment(client)} title={t('clients.actions.recordPayment', { name: client.name })} className="text-positive hover:text-positive" />
                      )}
                      <IconButton icon="Pencil" size="sm" onClick={() => openEditModal(client)} title={t('clients.actions.edit', { name: client.name })} />
                      <Button type="button" variant="secondary" size="sm" icon="Archive" onClick={() => requestDelete(client)}>
                        {t('clients.actions.archive')}
                      </Button>
                    </div>
                  </div>
                  </div>
                  <div className="rounded-md bg-surface-hover border border-border p-3">
                    <div className="flex flex-col gap-1 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
                      <span>{t('clients.history.title')}</span>
                      {client.paymentType === 'retainer' && <span>{t('clients.history.nextBilling', { date: client.nextBillingDate ? <span className="date-token">{formatDate(client.nextBillingDate, locale)}</span> : t('clients.payment.notScheduled') })}</span>}
                    </div>
                    {clientTransactions.length === 0 ? (
                      <div className="text-xs text-text-muted mt-2">{t('clients.history.empty')}</div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {clientTransactions.slice(0, 3).map((tx) => {
                          const originatedAsPending = !!(tx.expectedDate && tx.status === 'COMPLETED');
                          const datesDiffer = originatedAsPending && tx.expectedDate?.slice(0, 10) !== tx.date.slice(0, 10);
                          return (
                            <div key={tx.id} className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 truncate min-w-0">
                                <span className={`truncate text-text ${latinTokenClass(tx.name || tx.notes)}`}>
                                  {formatTransactionName(tx.name || tx.notes || t('clients.history.paymentFallback'), t as any)}
                                </span>
                                {originatedAsPending && (
                                  <Badge tone="positive" className="text-[10px] h-[18px] px-1.5 shrink-0">
                                    {t('pending.status.completed')}
                                  </Badge>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5 text-text-muted">
                                {datesDiffer && (
                                  <span className="text-[11px] text-text-muted">
                                    ({t('pending.history.expectedDate', { date: <span className="date-token">{formatDate(tx.expectedDate!, locale)}</span> })})
                                  </span>
                                )}
                                <span className="date-token">{formatDate(tx.date, locale)}</span>
                                <span>-</span>
                                <span dir="ltr">{money.format(tx.amount)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );})}
            </div>
          )}
        </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-[300px] overflow-hidden" pad={20}>
            <SectionHeader title={t('clients.revenue.title')} sub={t('clients.revenue.subtitle')} />
            {chartData.length === 0 ? (
              <div className="h-[210px] flex items-center justify-center text-sm text-text-muted">{t('clients.revenue.empty')}</div>
            ) : (
              <ClientRevenuePieChart data={chartData} formatAmount={money.format} />
            )}
          </Card>
          <Card pad={20}>
            <SectionHeader title={t('clients.top.title')} sub={t('clients.top.subtitle')} />
            {topClient ? (
              <div className="mt-4">
                <div className={`t-h3 text-text ${latinTokenClass(topClient.name)}`}>{topClient.name}</div>
                <div className="t-display text-positive mt-2">{moneyLong.format(revenueForClient(topClient.id))}</div>
                <p className="text-sm text-text-muted mt-1">{t('clients.top.totalRevenue')}</p>
              </div>
            ) : <p className="text-sm text-text-muted mt-4">{t('clients.top.empty')}</p>}
          </Card>
        </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-4" onMouseDown={closeModal}>
          <Card role="dialog" aria-modal="true" className="w-full max-w-[520px] max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-8" pad={24} onMouseDown={(event) => event.stopPropagation()}>
            <ClientForm client={modal.mode === 'edit' ? modal.client : undefined} currencyPrefix={currencyPrefix} error={modalError} isSaving={isSaving} onCancel={closeModal} onSave={saveClient} />
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[220] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-4" onMouseDown={closeDeleteModal}>
          <Card role="dialog" aria-modal="true" className="w-full max-w-[460px] max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl my-8" pad={24} onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="t-h3">{t('clients.delete.title', { name: deleteTarget.client.name })}</h2>
            <p className="text-sm text-text-secondary mt-2">
              {t('clients.delete.desc')}
            </p>
            <div className="mt-4 space-y-2">
              <div className="rounded-md bg-info-tint border border-info-border p-3 text-sm text-info">
                <span className="font-medium">{t('clients.delete.archiveLabel')}</span> {deleteTarget.transactionCount === 1 ? t('clients.delete.archiveNotice', { count: String(deleteTarget.transactionCount), amount: moneyLong.format(deleteTarget.revenueTotal) }) : t('clients.delete.archiveNoticePlural', { count: String(deleteTarget.transactionCount), amount: moneyLong.format(deleteTarget.revenueTotal) })}
              </div>
              <div className="rounded-md bg-negative-tint border border-negative-border p-3 text-sm text-negative">
                <span className="font-medium">{t('clients.delete.deleteLabel')}</span> {deleteTarget.transactionCount === 1 ? t('clients.delete.deleteNotice', { count: String(deleteTarget.transactionCount), amount: moneyLong.format(deleteTarget.revenueTotal) }) : t('clients.delete.deleteNoticePlural', { count: String(deleteTarget.transactionCount), amount: moneyLong.format(deleteTarget.revenueTotal) })}
              </div>
            </div>
            {deleteError && <div className="mt-3"><InlineAlert tone="negative">{deleteError}</InlineAlert></div>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-5 mt-5 border-t border-border">
              <Button type="button" variant="ghost" disabled={isDeleting || isDeletingPermanent} onClick={closeDeleteModal}>{t('clients.delete.cancel')}</Button>
              <Button type="button" variant="secondary" loading={isDeleting} disabled={isDeletingPermanent} onClick={confirmDelete}>{isDeleting ? t('clients.delete.archiving') : t('clients.actions.archive')}</Button>
              <Button type="button" variant="destructive" loading={isDeletingPermanent} disabled={isDeleting} onClick={confirmDeletePermanently}>{isDeletingPermanent ? t('clients.delete.deleting') : t('clients.delete.deletePermanently')}</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function ClientForm({ client, currencyPrefix, error, isSaving, onCancel, onSave }: { client?: Client; currencyPrefix: string; error: string | null; isSaving: boolean; onCancel: () => void; onSave: (formData: FormData, existing?: Client) => void }) {
  const { t } = useLocale();
  const [paymentType, setPaymentType] = useState<Client['paymentType']>(client?.paymentType || 'onetime');

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget), client); }} className="space-y-4">
      <div>
        <h2 className="t-h3">{client ? t('clients.form.editTitle') : t('clients.form.addTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('clients.form.subtitle')}</p>
      </div>
      {client && <InlineAlert tone="warning">{t('clients.form.warning')}</InlineAlert>}
      {error && <InlineAlert tone="negative">{error}</InlineAlert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('clients.form.nameLabel')}>
          <Input name="name" defaultValue={client?.name} required />
        </Field>
        <Field label={t('clients.form.amountLabel')}>
          <Input name="revenue" type="number" min="0" step="0.01" defaultValue={client?.revenue} required prefix={<span dir="ltr">{currencyPrefix}</span>} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('clients.form.companyLabel')}>
          <Input name="company" defaultValue={client?.company} />
        </Field>
        <Field label={t('clients.form.emailLabel')}>
          <Input name="email" type="email" defaultValue={client?.email} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('clients.form.clientTypeLabel')}>
          <Select name="clientType" defaultValue={client?.clientType || 'COMPANY'}>
            <option value="COMPANY">{t('clients.form.typeCompany')}</option>
            <option value="INDIVIDUAL">{t('clients.form.typeIndividual')}</option>
          </Select>
        </Field>
        <Field label={t('clients.form.statusLabel')}>
          <Select name="status" defaultValue={client?.status || 'ACTIVE'}>
            <option value="ACTIVE">{t('clients.form.statusActive')}</option>
            <option value="PROSPECT">{t('clients.form.statusProspect')}</option>
            <option value="COMPLETED">{t('clients.form.statusCompleted')}</option>
            <option value="INACTIVE">{t('clients.form.statusInactive')}</option>
          </Select>
        </Field>
      </div>
      <Field label={t('clients.form.paymentTypeLabel')}>
        <Select name="paymentType" value={paymentType} onChange={(event) => setPaymentType(event.target.value as Client['paymentType'])}>
          <option value="onetime">{t('clients.form.paymentOneTime')}</option>
          <option value="retainer">{t('clients.form.paymentRetainer')}</option>
        </Select>
      </Field>
      {paymentType === 'onetime' ? (
        <Field label={t('clients.form.paymentDateLabel')}>
          <Input name="paymentDate" type="date" defaultValue={client?.paymentDate ? String(client.paymentDate).slice(0, 10) : today()} required />
        </Field>
      ) : (
        <Field label={t('clients.form.nextBillingLabel')}>
          <Input name="nextBillingDate" type="date" defaultValue={client?.nextBillingDate ? String(client.nextBillingDate).slice(0, 10) : computeNextBillingDate(new Date().getDate())} required />
        </Field>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>{t('clients.form.cancel')}</Button>
        <Button type="submit" loading={isSaving}>{isSaving ? t('clients.form.saving') : t('clients.form.save')}</Button>
      </div>
    </form>
  );
}
