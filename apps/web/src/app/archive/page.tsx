'use client';

import { useMemo, useState } from 'react';
import { useFinancialStore } from '@/store/useFinancialStore';
import { makeCompactCurrencyFormatter } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { Avatar, Badge, Button, Card, EmptyState, Icon, InlineAlert, SectionHeader, StatCard } from '@/components/ui';

// Restore + permanent-delete actions for an archived row. The delete is a
// two-step inline confirm (no modal) so it can't be triggered by accident.
function RowActions({ count, onRestore, onDelete }: {
  count: number;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<null | 'restore' | 'delete'>(null);

  const run = async (kind: 'restore' | 'delete', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2 sm:justify-end shrink-0">
        <span className="t-small text-text-muted hidden md:block">
          {t('archive.actions.deletePermanently')}{count > 0 ? (count === 1 ? t('archive.actions.deleteConfirmTransactions', { count: String(count) }) : t('archive.actions.deleteConfirmTransactionsPlural', { count: String(count) })) : '?'}
        </span>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={busy !== null}>
          {t('archive.actions.cancel')}
        </Button>
        <Button type="button" variant="destructive" icon="Trash2" loading={busy === 'delete'} onClick={() => run('delete', onDelete)}>
          {t('archive.actions.delete')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:justify-end shrink-0">
      <Button type="button" variant="secondary" icon="RotateCcw" loading={busy === 'restore'} disabled={busy !== null} onClick={() => run('restore', onRestore)}>
        {t('archive.actions.restore')}
      </Button>
      <Button type="button" variant="ghost" icon="Trash2" disabled={busy !== null} onClick={() => setConfirming(true)} className="text-negative-text hover:text-negative-text">
        {t('archive.actions.delete')}
      </Button>
    </div>
  );
}

export default function ArchivePage() {
  const {
    clients, subscriptions, transactions, currency,
    restoreClient, restoreSubscription,
    deleteClientPermanently, deleteSubscriptionPermanently,
  } = useFinancialStore();
  const { t, locale } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const money = useMemo(() => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale), [currency, locale]);

  const archivedClients = useMemo(
    () => clients.filter((c) => c.archivedAt),
    [clients],
  );
  const archivedSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.archivedAt),
    [subscriptions],
  );

  const clientTransactionCount = (clientId: string) =>
    transactions.filter((tx) => tx.clientId === clientId || (tx.sourceType === 'client' && tx.sourceId === clientId)).length;

  const subscriptionTransactionCount = (subscriptionId: string) =>
    transactions.filter((tx) => tx.subscriptionId === subscriptionId || (tx.sourceType === 'subscription' && tx.sourceId === subscriptionId)).length;

  const guard = async (fn: () => Promise<void>, failMessage: string) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : failMessage);
      throw err;
    }
  };

  const isEmpty = archivedClients.length === 0 && archivedSubscriptions.length === 0;
  const archivedTransactionCount = archivedClients.reduce((sum, client) => sum + clientTransactionCount(client.id), 0)
    + archivedSubscriptions.reduce((sum, sub) => sum + subscriptionTransactionCount(sub.id), 0);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <div>
        <h1 className="t-h1">{t('archive.title')}</h1>
        <p className="t-body mt-1 text-text-muted">{t('archive.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('archive.stats.clients')} value={archivedClients.length} icon="Users" />
        <StatCard label={t('archive.stats.tools')} value={archivedSubscriptions.length} icon="CreditCard" />
        <StatCard label={t('archive.stats.records')} value={archivedTransactionCount} icon="Archive" />
      </div>

      <InlineAlert tone="info">
        {t('archive.info')}
      </InlineAlert>

      {error && (
        <InlineAlert tone="negative">{error}</InlineAlert>
      )}

      {isEmpty ? (
        <Card pad={0}>
          <EmptyState icon="Archive" title={t('archive.empty.title')} body={t('archive.empty.body')} />
        </Card>
      ) : (
        <>
          {archivedClients.length > 0 && (
            <Card pad={0} className="overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border">
                <SectionHeader title={t('archive.clients.title')} sub={archivedClients.length === 1 ? t('archive.clients.count', { count: String(archivedClients.length) }) : t('archive.clients.countPlural', { count: String(archivedClients.length) })} className="mb-0" />
              </div>
              <div className="divide-y divide-border">
                {archivedClients.map((client) => (
                  <div key={client.id} className="p-4 flex flex-col gap-3 hover:bg-surface-hover transition-colors sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={client.name} size={40} color="--viz-6" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="t-body-m text-text">{client.name}</span>
                          <Badge>{client.paymentType === 'retainer' ? t('archive.badges.retainer') : t('archive.badges.onetime')}</Badge>
                        </div>
                        <div className="text-sm text-text-muted mt-0.5">
                          {client.paymentType === 'retainer' ? t('archive.list.perMonth', { amount: <span dir="ltr">{money.format(client.revenue)}</span> }) : <span dir="ltr">{money.format(client.revenue)}</span>}
                          {' · '}
                          {clientTransactionCount(client.id) === 1 ? t('archive.list.transactions', { count: String(clientTransactionCount(client.id)) }) : t('archive.list.transactionsPlural', { count: String(clientTransactionCount(client.id)) })}
                          {client.archivedAt && (
                            <>
                              {' · '}
                              {t('archive.list.archivedDate', { date: <span className="date-token">{formatDate(client.archivedAt, locale)}</span> })}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <RowActions
                      count={clientTransactionCount(client.id)}
                      onRestore={() => guard(() => restoreClient(client.id), 'Failed to restore client')}
                      onDelete={() => guard(() => deleteClientPermanently(client.id), 'Failed to delete client')}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {archivedSubscriptions.length > 0 && (
            <Card pad={0} className="overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border">
                <SectionHeader title={t('archive.subscriptions.title')} sub={archivedSubscriptions.length === 1 ? t('archive.subscriptions.count', { count: String(archivedSubscriptions.length) }) : t('archive.subscriptions.countPlural', { count: String(archivedSubscriptions.length) })} className="mb-0" />
              </div>
              <div className="divide-y divide-border">
                {archivedSubscriptions.map((sub) => (
                  <div key={sub.id} className="p-4 flex flex-col gap-3 hover:bg-surface-hover transition-colors sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-surface-hover text-text-secondary flex items-center justify-center shrink-0">
                        <Icon name="CreditCard" size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="t-body-m text-text">{sub.name}</span>
                          <Badge>{t(`subscriptions.cycle.${(sub.billingCycle || sub.cycle).toLowerCase()}` as any)}</Badge>
                        </div>
                        <div className="text-sm text-text-muted mt-0.5">
                          {(sub.billingCycle || sub.cycle) === 'YEARLY'
                            ? t('archive.list.perYear', { amount: <span dir="ltr">{money.format(sub.amount)}</span> })
                            : (sub.billingCycle || sub.cycle) === 'QUARTERLY'
                              ? t('archive.list.perQuarter', { amount: <span dir="ltr">{money.format(sub.amount)}</span> })
                              : t('archive.list.perMonth', { amount: <span dir="ltr">{money.format(sub.amount)}</span> })}
                          {' · '}
                          {subscriptionTransactionCount(sub.id) === 1 ? t('archive.list.transactions', { count: String(subscriptionTransactionCount(sub.id)) }) : t('archive.list.transactionsPlural', { count: String(subscriptionTransactionCount(sub.id)) })}
                          {sub.archivedAt && (
                            <>
                              {' · '}
                              {t('archive.list.archivedDate', { date: <span className="date-token">{formatDate(sub.archivedAt, locale)}</span> })}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <RowActions
                      count={subscriptionTransactionCount(sub.id)}
                      onRestore={() => guard(() => restoreSubscription(sub.id), 'Failed to restore subscription')}
                      onDelete={() => guard(() => deleteSubscriptionPermanently(sub.id), 'Failed to delete subscription')}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
