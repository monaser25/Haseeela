'use client';

import dynamic from 'next/dynamic';
import { useFinancialStore } from '@/store/financialStore';
import { Client, Subscription, Transaction } from '@/types/finance';
import { computeNextBillingDate } from '@/store/financialStore';
import { getOverviewStats, selectOverduePendingCount } from '@/selectors/financialSelectors';
import { makeCompactCurrencyFormatter } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { useLocale, translateError } from '@/lib/i18n';
import { formatTransactionName } from '@/lib/format';
import { categoryLabel } from '@/lib/enumLabels';
import { latinTokenClass } from '@/lib/textDirection';
import type { Locale } from '@/lib/locales';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader, StatCard } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Field, Input, Select } from '@/components/ui/Form';
import { InlineAlert } from '@/components/ui/InlineAlert';

type ModalType = 'income' | 'expense' | 'client' | 'subscription' | null;
type MonthlyChartRow = {
  key: string;
  month: string;
  revenue: number;
  expenses: number;
};

const DashboardMonthlyChart = dynamic(
  () => import('@/components/charts/DashboardMonthlyChart').then((mod) => mod.DashboardMonthlyChart),
  { ssr: false, loading: () => <div className="h-[260px] w-full mt-4" /> },
);

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const today = () => new Date().toISOString().slice(0, 10);

function toIsoDate(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

function getRelativeDate(isoDate: string, locale: Locale, t: any) {
  const txDate = new Date(isoDate);
  const diff = new Date().getTime() - txDate.getTime();
  if (diff < 0) return formatDate(txDate, locale, { month: 'short', day: 'numeric' });
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t('dashboard.relativeDate.today');
  if (days === 1) return t('dashboard.relativeDate.yesterday');
  if (days < 7) return t('dashboard.relativeDate.daysAgo', { days: String(days) });
  return formatDate(txDate, locale, { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const {
    transactions,
    subscriptions,
    clients,
    currency,
    error,
    addTransaction,
    addClient,
    addSubscription,
  } = useFinancialStore();
  const [modal, setModal] = useState<ModalType>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const overview = useMemo(() => getOverviewStats(transactions, clients, subscriptions), [transactions, clients, subscriptions]);
  const overduePendingCount = useMemo(() => selectOverduePendingCount(transactions), [transactions]);
  
  const money0 = useMemo(() => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale), [currency, locale]);
  const money2 = useMemo(() => makeCompactCurrencyFormatter(currency, { minimumFractionDigits: 2 }, locale), [currency, locale]);
  const currencyPrefix = useMemo(() => money2.formatToParts(0).find((part) => part.type === 'currency')?.value || currency, [currency, money2]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'transaction') {
      setModal('income');
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const chartData = useMemo(() => {
    const labels: MonthlyChartRow[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      labels.push({
        key,
        month: formatDate(date, locale, { month: 'short' }),
        revenue: 0,
        expenses: 0,
      });
    }

    transactions.forEach((tx) => {
      if (tx.status !== 'COMPLETED') return;
      const key = tx.date.slice(0, 7);
      const bucket = labels.find((item) => item.key === key);
      if (!bucket) return;
      if (tx.type === 'INCOME') bucket.revenue += tx.amount;
      if (tx.type === 'EXPENSE') bucket.expenses += tx.amount;
    });

    return labels;
  }, [transactions, locale]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [transactions],
  );
  
  const activeSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.status === 'ACTIVE' && !sub.archivedAt)
           .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime())
           .slice(0, 4),
    [subscriptions],
  );

  const topClient = useMemo(() => {
    const clientRev = clients.map(client => {
      const rev = transactions
        .filter(t => t.type === 'INCOME' && (t.clientId === client.id || (t.sourceType === 'client' && t.sourceId === client.id)))
        .reduce((s, t) => s + t.amount, 0);
      return { ...client, value: rev };
    }).sort((a, b) => b.value - a.value);
    return clientRev.length > 0 && clientRev[0].value > 0 ? clientRev[0] : null;
  }, [clients, transactions]);

  const saveTransaction = async (formData: FormData, type: 'INCOME' | 'EXPENSE') => {
    const amount = Number(formData.get('amount'));
    const name = String(formData.get('name') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const date = String(formData.get('date') || today());
    const categoryId = String(formData.get('categoryId') || (type === 'INCOME' ? 'CLIENT' : 'TOOLS'));

    if (!name || !amount || amount <= 0) return;

    const tx: Transaction = {
      id: makeId(),
      name,
      amount,
      type,
      status: 'COMPLETED',
      date: toIsoDate(date),
      notes,
      sourceType: 'manual',
      categoryId,
    };

    setIsSaving(true);
    setModalError(null);
    try {
      await addTransaction(tx);
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? translateError(err.message, t) : t('dashboard.error.createTransaction'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveClient = async (formData: FormData) => {
    const paymentType = String(formData.get('paymentType') || 'onetime') as Client['paymentType'];
    const revenue = Number(formData.get('revenue') || 0);
    const name = String(formData.get('name') || '').trim();
    const paymentDate = String(formData.get('paymentDate') || today());
    const nextBillingDate = paymentType === 'retainer'
      ? String(formData.get('nextBillingDate') || computeNextBillingDate(new Date().getDate()))
      : undefined;

    if (!name || revenue <= 0) {
      setModalError(t('dashboard.error.missingClientFields'));
      return;
    }

    setIsSaving(true);
    setModalError(null);
    try {
      await addClient({
        id: makeId(),
        name,
        company: String(formData.get('company') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        revenue,
        clientType: String(formData.get('clientType') || 'COMPANY') as Client['clientType'],
        status: 'ACTIVE',
        paymentType,
        paymentDate: paymentType === 'onetime' ? paymentDate : undefined,
        billingDay: nextBillingDate ? Math.max(1, Math.min(28, new Date(`${nextBillingDate}T12:00:00`).getDate())) : undefined,
        nextBillingDate,
        recorded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? translateError(err.message, t) : t('dashboard.error.createClient'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveSubscription = async (formData: FormData) => {
    const name = String(formData.get('name') || '').trim();
    const amount = Number(formData.get('amount') || 0);
    const cycle = String(formData.get('billingCycle') || 'MONTHLY') as Subscription['cycle'];
    const nextBillingDate = String(formData.get('nextBillingDate') || computeNextBillingDate(new Date().getDate()));

    if (!name || amount <= 0 || !nextBillingDate) {
      setModalError(t('dashboard.error.missingSubFields'));
      return;
    }

    setIsSaving(true);
    setModalError(null);
    try {
      await addSubscription({
        id: makeId(),
        name,
        amount,
        cycle,
        billingCycle: cycle,
        notes: String(formData.get('notes') || '').trim(),
        billingDay: Math.max(1, Math.min(28, new Date(`${nextBillingDate}T12:00:00`).getDate())),
        nextBillingDate,
        status: 'ACTIVE',
      });
      setModal(null);
    } catch (err) {
      setModalError(err instanceof Error ? translateError(err.message, t) : t('dashboard.error.createSubscription'));
    } finally {
      setIsSaving(false);
    }
  };

  const chartRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
  const chartExpenses = chartData.reduce((sum, item) => sum + item.expenses, 0);
  const chartMargin = chartRevenue > 0 ? Math.round(((chartRevenue - chartExpenses) / chartRevenue) * 100) : 0;
  const chartMarginLabel = t('dashboard.chart.margin', { margin: `${chartMargin > 0 ? '+' : ''}${chartMargin}` });

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      {error && (
        <InlineAlert tone="warning" title={t('dashboard.alert.syncIssue')}>
        <div className="flex flex-col gap-2 items-start">
        <p>{translateError(error, t)}</p>
        <button 
              className="text-sm font-semibold underline text-warning-strong hover:text-warning-text"
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
                    }
                  });
                }
                const userId = useFinancialStore.getState().storageUserId;
                if (userId) localStorage.removeItem(`flowledger-financial-state:${userId}`);
                window.location.reload();
              }}
            >
              {t('dashboard.alert.retry')}
            </button>
          </div>
        </InlineAlert>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2.5">
        <Button icon="TrendingUp" onClick={() => { setModalError(null); setModal('income'); }}>{t('dashboard.actions.addRevenue')}</Button>
        <Button variant="secondary" icon="Receipt" onClick={() => { setModalError(null); setModal('expense'); }}>{t('dashboard.actions.logExpense')}</Button>
        <Button variant="secondary" icon="RefreshCw" onClick={() => { setModalError(null); setModal('subscription'); }}>{t('dashboard.actions.addSubscription')}</Button>
        <Button variant="secondary" icon="Users" onClick={() => { setModalError(null); setModal('client'); }}>{t('dashboard.actions.addClient')}</Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          tier="raised"
          className="col-span-1 sm:col-span-2"
          label={t('dashboard.stats.netProfit')}
          value={<span className="text-[28px] sm:text-[32px]">{money0.format(overview.netProfit)}</span>}
          tone={overview.netProfit >= 0 ? 'positive' : 'negative'}
          icon="Wallet"
          onClick={() => router.push('/analytics')}
        />
        <StatCard
          label={t('dashboard.stats.totalRevenue')}
          value={money0.format(overview.totalRevenue)}
          tone="positive"
          icon="TrendingUp"
          onClick={() => router.push('/transactions?filter=revenue')}
        />
        <StatCard
          label={t('pending.kpi.title')}
          value={<span dir="ltr">{money0.format(overview.pendingTotal)}</span>}
          tone="warning"
          icon="Clock"
          onClick={() => router.push('/clients#pending')}
          sub={
            overduePendingCount > 0 ? (
              <span className="flex items-center gap-1 flex-wrap">
                <span>{overview.pendingCount === 1 ? t('pending.kpi.sub', { count: String(overview.pendingCount) }) : t('pending.kpi.subPlural', { count: String(overview.pendingCount) })}</span>
                <span className="text-negative-text font-medium">({overduePendingCount === 1 ? t('pending.kpi.overdue', { count: String(overduePendingCount) }) : t('pending.kpi.overduePlural', { count: String(overduePendingCount) })})</span>
              </span>
            ) : (
              overview.pendingCount === 1 ? t('pending.kpi.sub', { count: String(overview.pendingCount) }) : t('pending.kpi.subPlural', { count: String(overview.pendingCount) })
            )
          }
        />
        <StatCard
          label={t('dashboard.stats.totalExpenses')}
          value={money0.format(overview.totalExpenses)}
          tone="negative"
          icon="Receipt"
          onClick={() => router.push('/transactions?filter=expenses')}
        />
        <StatCard 
          label={t('dashboard.stats.totalClients')} 
          value={overview.totalClients} 
          icon="Users" 
          onClick={() => router.push('/clients')} 
        />
        <StatCard 
          label={t('dashboard.stats.activeSubscriptions')} 
          value={overview.activeSubscriptionsCount} 
          sub={`${money0.format(overview.subscriptionBurden)}${t('dashboard.stats.perMonth')}`} 
          icon="RefreshCw" 
          onClick={() => router.push('/subscriptions')} 
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2 h-full" pad={22}>
          <SectionHeader 
            title={t('dashboard.chart.title')} 
            sub={t('dashboard.chart.subtitle')} 
            action={<Badge tone={chartMargin >= 0 ? 'positive' : 'negative'} icon={chartMargin >= 0 ? 'TrendingUp' : 'TrendingDown'}>{chartMarginLabel}</Badge>} 
          />
          <DashboardMonthlyChart data={chartData} formatAmount={money0.format} />
        </Card>

        <div className="flex flex-col gap-4">
          <Card pad={20}>
            <SectionHeader 
              title={t('dashboard.subs.title')} 
              action={
                <button onClick={() => router.push('/subscriptions')} className="text-sm font-medium text-accent hover:underline">
                  {t('dashboard.subs.viewAll')}
                </button>
              } 
            />
            {activeSubscriptions.length > 0 ? (
              <div className="flex flex-col gap-1 mt-2">
                {activeSubscriptions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2">
                    <Avatar name={s.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className={`t-body-m truncate ${latinTokenClass(s.name)}`}>{s.name}</div>
                      <div className="text-xs text-text-muted">{t('dashboard.subs.renews', { date: <span className="date-token">{formatDate(s.nextBillingDate, locale, { month: 'short', day: 'numeric' })}</span> })}</div>
                    </div>
                    <span className="t-body-m font-mono" dir="ltr">{money0.format(s.amount)}<span className="text-text-muted font-sans text-xs">{s.cycle === 'YEARLY' ? t('dashboard.subs.perYear') : t('dashboard.subs.perMonth')}</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted py-4 text-center">{t('dashboard.subs.empty')}</div>
            )}
          </Card>

          {topClient && (
            <Card pad={20}>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">{t('dashboard.topClient.title')}</div>
              <div className="flex items-center gap-3">
                <Avatar name={topClient.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className={`t-h3 truncate ${latinTokenClass(topClient.name)}`}>{topClient.name}</div>
                  <div className={`text-sm text-text-muted truncate ${latinTokenClass(topClient.email || topClient.company)}`}>{topClient.email || topClient.company || t('dashboard.topClient.fallbackRole')}</div>
                </div>
              </div>
              <div className="mt-4 pt-3.5 border-t border-border flex justify-between items-baseline">
                <span className="text-sm text-text-muted">{t('dashboard.topClient.totalPaid')}</span>
                <span className="t-h3 font-mono text-positive-text" dir="ltr">{money0.format(topClient.value)}</span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <Card pad={0}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <span className="t-h3">{t('dashboard.recent.title')}</span>
          <button 
            onClick={() => router.push('/transactions')} 
            className="text-sm font-medium text-accent hover:underline inline-flex items-center gap-1"
          >
            {t('dashboard.recent.viewLedger')} <Icon name="ChevronRight" size={14} className="rtl:-scale-x-100" />
          </button>
        </div>
        
        {recentTransactions.length === 0 ? (
          <div className="text-center py-10 px-4 text-text-muted">
            <div className="mb-3 text-border-strong flex justify-center"><Icon name="Inbox" size={34} /></div>
            <p className="text-sm">{t('dashboard.recent.empty')}</p>
            <button onClick={() => setModal('income')} className="mt-4 text-sm font-medium text-accent hover:underline">
              {t('dashboard.recent.emptyAction')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr 
                    key={tx.id} 
                    onClick={() => router.push('/transactions')} 
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push('/transactions');
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="border-b last:border-b-0 border-border hover:bg-surface-hover focus:bg-surface-hover focus:outline-none cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-positive-tint text-positive-text' : 'bg-negative-tint text-negative-text'}`}>
                          <Icon name={tx.type === 'INCOME' ? 'ArrowDown' : 'ArrowUp'} size={15} strokeWidth={2.2} />
                        </div>
                        <div>
                          <div className={`t-body-m ${latinTokenClass(tx.name || tx.notes)}`}>{formatTransactionName(tx.name || tx.notes || tx.sourceType, t)}</div>
                          <div className="text-xs text-text-muted mt-0.5">{categoryLabel(tx.categoryId, t)} &middot; {getRelativeDate(tx.date, locale, t)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`t-body-m font-mono ${tx.type === 'INCOME' ? 'text-positive-text' : 'text-negative-text'}`} dir="ltr">
                        {tx.type === 'INCOME' ? '+' : '−'}{money2.format(tx.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto" onMouseDown={() => { if (!isSaving) setModal(null); }}>
          <Card role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title" className="w-full max-w-md my-8 relative shadow-xl" pad={24} onMouseDown={(event) => event.stopPropagation()}>
            {(modal === 'income' || modal === 'expense') && (
              <DashboardTransactionForm
                type={modal === 'income' ? 'INCOME' : 'EXPENSE'}
                currencyPrefix={currencyPrefix}
                error={modalError}
                isSaving={isSaving}
                onCancel={() => setModal(null)}
                onSave={saveTransaction}
              />
            )}
            {modal === 'client' && (
              <DashboardClientForm
                currencyPrefix={currencyPrefix}
                error={modalError}
                isSaving={isSaving}
                onCancel={() => setModal(null)}
                onSave={saveClient}
              />
            )}
            {modal === 'subscription' && (
              <DashboardSubscriptionForm
                currencyPrefix={currencyPrefix}
                error={modalError}
                isSaving={isSaving}
                onCancel={() => setModal(null)}
                onSave={saveSubscription}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function DashboardTransactionForm({ type, currencyPrefix, error, isSaving, onCancel, onSave }: { type: 'INCOME' | 'EXPENSE'; currencyPrefix: string; error: string | null; isSaving: boolean; onCancel: () => void; onSave: (formData: FormData, type: 'INCOME' | 'EXPENSE') => void }) {
  const { t } = useLocale();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget), type);
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 id="dashboard-modal-title" className="t-h3">{type === 'INCOME' ? t('dashboard.forms.income.title') : t('dashboard.forms.expense.title')}</h2>
        <p className="text-sm text-text-muted mt-1">{type === 'INCOME' ? t('dashboard.forms.income.subtitle') : t('dashboard.forms.expense.subtitle')}</p>
        {error && <p className="text-sm text-negative-text mt-2">{error}</p>}
      </div>
      <Field label={t('dashboard.forms.tx.nameLabel')}>
        <Input name="name" placeholder={type === 'INCOME' ? t('dashboard.forms.tx.nameIncomePlaceholder') : t('dashboard.forms.tx.nameExpensePlaceholder')} required autoFocus />
      </Field>
      <Field label={t('dashboard.forms.tx.notesLabel')}>
        <Input name="notes" placeholder={t('dashboard.forms.tx.notesPlaceholder')} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.tx.amountLabel')}>
          <Input name="amount" type="number" min="0" step="0.01" required prefix={currencyPrefix} />
        </Field>
        <Field label={t('dashboard.forms.tx.dateLabel')}>
          <Input name="date" type="date" defaultValue={today()} required />
        </Field>
      </div>
      <Field label={t('dashboard.forms.tx.categoryLabel')}>
        <Select name="categoryId">
          {type === 'INCOME' ? (
            <>
              <option value="CLIENT">{t('dashboard.forms.tx.catClient')}</option>
              <option value="PROJECT">{t('dashboard.forms.tx.catProject')}</option>
              <option value="OTHER">{t('dashboard.forms.tx.catOtherIncome')}</option>
            </>
          ) : (
            <>
              <option value="TOOLS">{t('dashboard.forms.tx.catTools')}</option>
              <option value="OPERATIONS">{t('dashboard.forms.tx.catOps')}</option>
              <option value="TAXES">{t('dashboard.forms.tx.catTaxes')}</option>
              <option value="OTHER">{t('dashboard.forms.tx.catOtherExpense')}</option>
            </>
          )}
        </Select>
      </Field>
      <div className="flex justify-end gap-2 pt-2 mt-2">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>{t('dashboard.forms.cancel')}</Button>
        <Button type="submit" loading={isSaving}>{isSaving ? t('dashboard.forms.saving') : t('dashboard.forms.tx.save')}</Button>
      </div>
    </form>
  );
}

function DashboardClientForm({ currencyPrefix, error, isSaving, onCancel, onSave }: { currencyPrefix: string; error: string | null; isSaving: boolean; onCancel: () => void; onSave: (formData: FormData) => void }) {
  const { t } = useLocale();
  const [paymentType, setPaymentType] = useState<Client['paymentType']>('onetime');

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} className="flex flex-col gap-4">
      <div>
        <h2 id="dashboard-modal-title" className="t-h3">{t('dashboard.forms.client.title')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('dashboard.forms.client.subtitle')}</p>
        {error && <p className="text-sm text-negative-text mt-2">{error}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.client.nameLabel')}>
          <Input name="name" required autoFocus />
        </Field>
        <Field label={t('dashboard.forms.client.amountLabel')}>
          <Input name="revenue" type="number" min="0" step="0.01" required prefix={currencyPrefix} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.client.companyLabel')}>
          <Input name="company" />
        </Field>
        <Field label={t('dashboard.forms.client.emailLabel')}>
          <Input name="email" type="email" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.client.typeLabel')}>
          <Select name="clientType" defaultValue="COMPANY">
            <option value="COMPANY">{t('dashboard.forms.client.typeCompany')}</option>
            <option value="INDIVIDUAL">{t('dashboard.forms.client.typeIndividual')}</option>
          </Select>
        </Field>
        <Field label={t('dashboard.forms.client.paymentTypeLabel')}>
          <Select name="paymentType" value={paymentType} onChange={(event) => setPaymentType(event.target.value as Client['paymentType'])}>
            <option value="onetime">{t('dashboard.forms.client.paymentOneTime')}</option>
            <option value="retainer">{t('dashboard.forms.client.paymentRetainer')}</option>
          </Select>
        </Field>
      </div>
      {paymentType === 'retainer' ? (
        <Field label={t('dashboard.forms.client.nextBillingLabel')}>
          <Input name="nextBillingDate" type="date" defaultValue={computeNextBillingDate(new Date().getDate())} required />
        </Field>
      ) : (
        <Field label={t('dashboard.forms.client.paymentDateLabel')}>
          <Input name="paymentDate" type="date" defaultValue={today()} required />
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-2 mt-2">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>{t('dashboard.forms.cancel')}</Button>
        <Button type="submit" loading={isSaving}>{isSaving ? t('dashboard.forms.saving') : t('dashboard.forms.client.save')}</Button>
      </div>
    </form>
  );
}

function DashboardSubscriptionForm({ currencyPrefix, error, isSaving, onCancel, onSave }: { currencyPrefix: string; error: string | null; isSaving: boolean; onCancel: () => void; onSave: (formData: FormData) => void }) {
  const { t } = useLocale();
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave(new FormData(event.currentTarget)); }} className="flex flex-col gap-4">
      <div>
        <h2 id="dashboard-modal-title" className="t-h3">{t('dashboard.forms.sub.title')}</h2>
        <p className="text-sm text-text-muted mt-1">{t('dashboard.forms.sub.subtitle')}</p>
        {error && <p className="text-sm text-negative-text mt-2">{error}</p>}
      </div>
      <Field label={t('dashboard.forms.sub.nameLabel')}>
        <Input name="name" placeholder={t('dashboard.forms.sub.namePlaceholder')} required autoFocus />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.sub.costLabel')}>
          <Input name="amount" type="number" min="0" step="0.01" required prefix={currencyPrefix} />
        </Field>
        <Field label={t('dashboard.forms.sub.nextBillingLabel')}>
          <Input name="nextBillingDate" type="date" defaultValue={computeNextBillingDate(new Date().getDate())} required />
        </Field>
      </div>
      <Field label={t('dashboard.forms.sub.cycleLabel')}>
        <Select name="billingCycle" defaultValue="MONTHLY">
          <option value="MONTHLY">{t('dashboard.forms.sub.cycleMonthly')}</option>
          <option value="QUARTERLY">{t('dashboard.forms.sub.cycleQuarterly')}</option>
          <option value="YEARLY">{t('dashboard.forms.sub.cycleYearly')}</option>
        </Select>
      </Field>
      <Field label={t('dashboard.forms.sub.notesLabel')}>
        <Input name="notes" placeholder={t('dashboard.forms.sub.notesPlaceholder')} />
      </Field>
      <div className="flex justify-end gap-2 pt-2 mt-2">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>{t('dashboard.forms.cancel')}</Button>
        <Button type="submit" loading={isSaving}>{isSaving ? t('dashboard.forms.saving') : t('dashboard.forms.sub.save')}</Button>
      </div>
    </form>
  );
}
