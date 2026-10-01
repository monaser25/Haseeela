'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFinancialStore } from '@/store/useFinancialStore';
import { Transaction } from '@/types/finance';
import { makeCompactCurrencyFormatter } from '@/lib/currency';
import { categoryLabel } from '@/lib/enumLabels';
import { formatDate as formatLocaleDate } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { latinTokenClass } from '@/lib/textDirection';
import type { Locale } from '@/lib/locales';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, FilterChip } from '@/components/ui/Badge';
import { Card, SectionHeader, StatCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { InlineAlert } from '@/components/ui/InlineAlert';

type Filter = 'all' | 'revenue' | 'expenses' | 'subscriptions' | 'client' | 'tools' | 'operations';
type CurrencyFormatter = ReturnType<typeof makeCompactCurrencyFormatter>;

const filters: { id: Filter }[] = [
  { id: 'all' },
  { id: 'revenue' },
  { id: 'expenses' },
  { id: 'subscriptions' },
  { id: 'client' },
  { id: 'tools' },
  { id: 'operations' },
];

const today = () => new Date().toISOString().slice(0, 10);

function toIsoDate(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isAutoTransaction = (tx: Transaction) => Boolean(tx.isAuto) || tx.sourceType !== 'manual';

function matchesFilter(tx: Transaction, filter: Filter) {
  if (filter === 'revenue') return tx.type === 'INCOME';
  if (filter === 'expenses') return tx.type === 'EXPENSE';
  if (filter === 'subscriptions') return tx.sourceType === 'subscription';
  if (filter === 'client') return tx.sourceType === 'client';
  if (filter === 'tools') return tx.categoryId === 'TOOLS';
  if (filter === 'operations') return tx.categoryId === 'OPERATIONS';
  return true;
}

function transactionTitle(tx: Transaction, t: any) {
  return tx.name || tx.notes || t('transactions.labels.unnamed');
}

function sourceLabel(tx: Transaction, t: any) {
  if (tx.sourceType === 'client') return t('transactions.labels.clientPayment');
  if (tx.sourceType === 'subscription') return t('transactions.labels.subscription');
  return t('transactions.labels.manual');
}

function formatTransactionDate(value: string, locale: Locale) {
  return formatLocaleDate(value, locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TransactionsPage() {
  const { transactions, currency, addTransaction, updateTransaction, deleteTransaction } = useFinancialStore();
  const { t, locale, dir } = useLocale();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const money = useMemo(() => makeCompactCurrencyFormatter(currency, { minimumFractionDigits: 2 }, locale), [currency, locale]);
  const money0 = useMemo(() => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale), [currency, locale]);
  const currencyPrefix = useMemo(() => money.formatToParts(0).find((part) => part.type === 'currency')?.value || currency, [currency, money]);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('filter') as Filter | null;
    if (param && filters.some((item) => item.id === param)) setFilter(param);
  }, []);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...transactions]
      .filter((tx) => matchesFilter(tx, filter))
      .filter((tx) => {
        if (!normalizedQuery) return true;
        return [transactionTitle(tx, t), tx.notes, tx.categoryId, tx.sourceType, tx.type, tx.amount.toString()]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filter, query, t, transactions]);

  const filterCounts = useMemo(() => {
    return filters.reduce<Record<Filter, number>>((acc, item) => {
      acc[item.id] = transactions.filter((tx) => matchesFilter(tx, item.id)).length;
      return acc;
    }, {} as Record<Filter, number>);
  }, [transactions]);

  const ledgerStats = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.type === 'INCOME') acc.revenue += tx.amount;
        if (tx.type === 'EXPENSE') acc.expenses += tx.amount;
        if (tx.sourceType === 'manual') acc.manual += 1;
        if (isAutoTransaction(tx)) acc.generated += 1;
        return acc;
      },
      { revenue: 0, expenses: 0, manual: 0, generated: 0 },
    );
  }, [transactions]);

  const saveEdit = async (formData: FormData) => {
    if (!editing) return;
    const name = String(formData.get('name') || '').trim();
    const amount = Number(formData.get('amount'));
    const notes = String(formData.get('notes') || '').trim();
    const dateValue = String(formData.get('date') || '').trim();

    if (!name || !amount || amount <= 0) {
      setModalError(t('transactions.form.errorNameAmount'));
      return;
    }

    setIsSaving(true);
    setModalError(null);
    try {
      const payload: Partial<Transaction> = { name, amount, notes };
      if (dateValue) payload.date = toIsoDate(dateValue);
      await updateTransaction(editing.id, payload);
      setEditing(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('transactions.form.errorUpdate'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveNew = async (formData: FormData) => {
    const amount = Number(formData.get('amount'));
    const name = String(formData.get('name') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const type = String(formData.get('type') || 'EXPENSE') as Transaction['type'];
    const date = String(formData.get('date') || today());
    const categoryId = String(formData.get('categoryId') || (type === 'INCOME' ? 'CLIENT' : 'TOOLS'));

    if (!name || !amount || amount <= 0) {
      setModalError(t('transactions.form.errorNameAmount'));
      return;
    }

    setIsSaving(true);
    setModalError(null);
    try {
      await addTransaction({
        id: makeId(),
        name,
        amount,
        type,
        status: 'COMPLETED',
        date: toIsoDate(date),
        notes,
        sourceType: 'manual',
        categoryId,
      });
      setAdding(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('transactions.form.errorCreate'));
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = (tx: Transaction) => {
    setDeleteError(null);
    setDeleting(tx);
  };

  const closeDeleteModal = () => { if (!isDeleting) setDeleting(null); };

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteTransaction(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('transactions.delete.error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddModal = () => {
    setModalError(null);
    setAdding(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalError(null);
    setEditing(tx);
  };

  return (
    <>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="t-h1">{t('transactions.title')}</h1>
            <p className="t-body mt-1 text-text-muted">{t('transactions.subtitle')}</p>
          </div>
          <Button icon="Plus" onClick={openAddModal} className="w-full sm:w-auto">{t('transactions.add')}</Button>
        </div>

        <div className="border-y border-border py-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          <div className="px-3 sm:px-4">
            <span className="t-caption text-text-muted">{t('transactions.stats.revenue')}</span>
            <div className="t-h3 tnum text-positive-text mt-0.5" dir="ltr">{money0.format(ledgerStats.revenue)}</div>
          </div>
          <div className="px-3 sm:px-4">
            <span className="t-caption text-text-muted">{t('transactions.stats.expenses')}</span>
            <div className="t-h3 tnum text-negative-text mt-0.5" dir="ltr">{money0.format(ledgerStats.expenses)}</div>
          </div>
          <div className="px-3 sm:px-4">
            <span className="t-caption text-text-muted">{t('transactions.stats.manual')}</span>
            <div className="t-h3 tnum text-text mt-0.5" dir="ltr">{ledgerStats.manual}</div>
          </div>
          <div className="px-3 sm:px-4">
            <span className="t-caption text-text-muted">{t('transactions.stats.generated')}</span>
            <div className="t-h3 tnum text-text mt-0.5" dir="ltr">{ledgerStats.generated}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <FilterChip key={item.id} active={filter === item.id} count={filterCounts[item.id]} onClick={() => setFilter(item.id)}>
              {t(`transactions.filters.${item.id}` as any)}
            </FilterChip>
          ))}
        </div>

        <Card tier="raised" pad={0}>
          <div className="p-4 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SectionHeader
              title={t('transactions.ledger.title')}
              sub={filteredTransactions.length === 1 ? t('transactions.ledger.shown', { count: 1 }) : t('transactions.ledger.shownPlural', { count: filteredTransactions.length })}
              className="mb-0"
            />
            <div className="w-full lg:w-[320px]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('transactions.search.placeholder')}
                prefix={<Icon name="Search" size={15} />}
                data-search="true"
                className="text-start"
              />
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon="WalletCards"
              title={t('transactions.empty.title')}
              body={query ? t('transactions.empty.bodySearch') : t('transactions.empty.body')}
              action={<Button icon="Plus" onClick={openAddModal}>{t('transactions.add')}</Button>}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] border-collapse" dir={dir}>
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      <TableHead className="min-w-[260px]">{t('transactions.table.desc')}</TableHead>
                      <TableHead className="min-w-[130px]">{t('transactions.table.category')}</TableHead>
                      <TableHead className="min-w-[140px]">{t('transactions.table.date')}</TableHead>
                      <TableHead className="min-w-[170px]">{t('transactions.table.type')}</TableHead>
                      <TableHead align="end" className="min-w-[140px]">{t('transactions.table.amount')}</TableHead>
                      <TableHead align="end" className="w-[96px]">{t('transactions.table.actions')}</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        money={money}
                        locale={locale}
                        onEdit={openEditModal}
                        onDelete={requestDelete}
                        t={t}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {filteredTransactions.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    transaction={tx}
                    money={money}
                    locale={locale}
                    onEdit={openEditModal}
                    onDelete={requestDelete}
                    t={t}
                  />
                ))}
              </div>

              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-text-muted">
                <span>{filteredTransactions.length === 1 ? t('transactions.ledger.shown', { count: 1 }) : t('transactions.ledger.shownPlural', { count: filteredTransactions.length })}</span>
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="font-medium text-accent hover:underline">
                    {t('transactions.actions.clearSearch')}
                  </button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {editing && (
        <ModalFrame onClose={() => { if (!isSaving) setEditing(null); }}>
          <TransactionForm
            mode="edit"
            transaction={editing}
            currencyPrefix={currencyPrefix}
            error={modalError}
            isSaving={isSaving}
            onCancel={() => setEditing(null)}
            onSave={saveEdit}
            t={t}
          />
        </ModalFrame>
      )}

      {deleting && (
        <ModalFrame onClose={closeDeleteModal} zIndex="z-[220]">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-negative-tint text-negative-text flex items-center justify-center shrink-0">
                <Icon name="AlertTriangle" size={20} />
              </div>
              <div>
                <h2 className="t-h3">{t('transactions.delete.title')}</h2>
                <p className="text-sm text-text-secondary mt-1">
                  {isAutoTransaction(deleting)
                    ? t('transactions.delete.descAuto')
                    : t('transactions.delete.descManual')}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-surface-hover border border-border p-3 text-sm">
              <div className="font-medium text-text">{transactionTitle(deleting, t)}</div>
              <div className="mt-1 text-text-muted"><span className="date-token">{formatTransactionDate(deleting.date, locale)}</span> - <span dir="ltr">{deleting.type === 'INCOME' ? '+' : '-'}{money.format(deleting.amount)}</span></div>
            </div>
            {deleteError && <InlineAlert tone="negative">{deleteError}</InlineAlert>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" disabled={isDeleting} onClick={closeDeleteModal}>{t('transactions.delete.cancel')}</Button>
              <Button type="button" variant="destructive" loading={isDeleting} onClick={confirmDelete}>{isDeleting ? t('transactions.delete.deleting') : t('transactions.delete.confirm')}</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {adding && (
        <ModalFrame onClose={() => { if (!isSaving) setAdding(false); }}>
          <TransactionForm
            mode="add"
            currencyPrefix={currencyPrefix}
            error={modalError}
            isSaving={isSaving}
            onCancel={() => setAdding(false)}
            onSave={saveNew}
            t={t}
          />
        </ModalFrame>
      )}
    </>
  );
}

function TableHead({ children, align = 'start', className = '' }: { children: React.ReactNode; align?: 'start' | 'end'; className?: string }) {
  return (
    <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted ${align === 'end' ? 'text-end' : 'text-start'} ${className}`}>
      {children}
    </th>
  );
}

function TransactionRow({ transaction, money, locale, onEdit, onDelete, t }: { transaction: Transaction; money: CurrencyFormatter; locale: Locale; onEdit: (tx: Transaction) => void; onDelete: (tx: Transaction) => void; t: any }) {
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-start gap-3">
          <TransactionIcon type={transaction.type} />
          <div className="min-w-0">
            <div className={`t-body-m truncate ${latinTokenClass(transactionTitle(transaction, t))}`}>{transactionTitle(transaction, t)}</div>
            {transaction.notes && transaction.notes !== transaction.name && <div className="text-xs text-text-muted mt-0.5 truncate max-w-[320px]">{transaction.notes}</div>}
            <div className="text-xs text-text-muted mt-1">{sourceLabel(transaction, t)}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4"><Badge className="justify-center">{categoryLabel(transaction.categoryId, t)}</Badge></td>
      <td className="px-5 py-4 text-sm text-text-secondary whitespace-nowrap"><span className="date-token">{formatTransactionDate(transaction.date, locale)}</span></td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={transaction.type === 'INCOME' ? 'positive' : 'negative'}>{transaction.type === 'INCOME' ? t('transactions.badges.revenue') : t('transactions.badges.expense')}</Badge>
          {isAutoTransaction(transaction) && <Badge tone="neutral" icon="RefreshCw">{t('transactions.badges.auto')}</Badge>}
          {transaction.isEdited && <Badge tone="warning" icon="Pencil">{t('transactions.badges.edited')}</Badge>}
        </div>
      </td>
      <td className={`px-5 py-4 text-end font-mono text-sm font-medium whitespace-nowrap ${transaction.type === 'INCOME' ? 'text-positive-text' : 'text-negative-text'}`}>
        <span dir="ltr">{transaction.type === 'INCOME' ? '+' : '-'}{money.format(transaction.amount)}</span>
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end rtl:justify-start gap-1">
          <IconButton icon="Pencil" size="sm" title={`${t('transactions.actions.edit')} ${transactionTitle(transaction, t)}`} onClick={() => onEdit(transaction)} />
          <IconButton icon="Trash2" size="sm" title={`${t('transactions.actions.delete')} ${transactionTitle(transaction, t)}`} className="text-negative-text hover:text-negative-text" onClick={() => onDelete(transaction)} />
        </div>
      </td>
    </tr>
  );
}

function TransactionCard({ transaction, money, locale, onEdit, onDelete, t }: { transaction: Transaction; money: CurrencyFormatter; locale: Locale; onEdit: (tx: Transaction) => void; onDelete: (tx: Transaction) => void; t: any }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <TransactionIcon type={transaction.type} />
          <div className="min-w-0">
            <div className={`t-body-m truncate ${latinTokenClass(transactionTitle(transaction, t))}`}>{transactionTitle(transaction, t)}</div>
            <div className="text-xs text-text-muted mt-0.5"><span className="date-token">{formatTransactionDate(transaction.date, locale)}</span> - {sourceLabel(transaction, t)}</div>
          </div>
        </div>
        <div className={`font-mono text-sm font-medium shrink-0 ${transaction.type === 'INCOME' ? 'text-positive-text' : 'text-negative-text'}`}>
          <span dir="ltr">{transaction.type === 'INCOME' ? '+' : '-'}{money.format(transaction.amount)}</span>
        </div>
      </div>
      {transaction.notes && transaction.notes !== transaction.name && <div className="text-sm text-text-secondary">{transaction.notes}</div>}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge>{categoryLabel(transaction.categoryId, t)}</Badge>
          <Badge tone={transaction.type === 'INCOME' ? 'positive' : 'negative'}>{transaction.type === 'INCOME' ? t('transactions.badges.revenue') : t('transactions.badges.expense')}</Badge>
          {isAutoTransaction(transaction) && <Badge tone="neutral" icon="RefreshCw">{t('transactions.badges.auto')}</Badge>}
          {transaction.isEdited && <Badge tone="warning" icon="Pencil">{t('transactions.badges.edited')}</Badge>}
        </div>
        <div className="flex gap-1 shrink-0">
          <IconButton icon="Pencil" size="sm" title={`${t('transactions.actions.edit')} ${transactionTitle(transaction, t)}`} onClick={() => onEdit(transaction)} />
          <IconButton icon="Trash2" size="sm" title={`${t('transactions.actions.delete')} ${transactionTitle(transaction, t)}`} className="text-negative-text hover:text-negative-text" onClick={() => onDelete(transaction)} />
        </div>
      </div>
    </div>
  );
}

function TransactionIcon({ type }: { type: Transaction['type'] }) {
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${type === 'INCOME' ? 'bg-positive-tint text-positive-text' : 'bg-negative-tint text-negative-text'}`}>
      <Icon name={type === 'INCOME' ? 'ArrowDown' : 'ArrowUp'} size={16} strokeWidth={2.2} />
    </div>
  );
}

function ModalFrame({ children, onClose, zIndex = 'z-[200]' }: { children: React.ReactNode; onClose: () => void; zIndex?: string }) {
  return (
    <div className={`fixed inset-0 ${zIndex} bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto`} onMouseDown={onClose}>
      <Card
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md my-8 relative shadow-xl"
        pad={24}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </Card>
    </div>
  );
}

function TransactionForm({ mode, transaction, currencyPrefix, error, isSaving, onCancel, onSave, t }: { mode: 'add' | 'edit'; transaction?: Transaction; currencyPrefix: string; error: string | null; isSaving: boolean; onCancel: () => void; onSave: (formData: FormData) => void; t: any }) {
  const isEdit = mode === 'edit';
  const isAuto = transaction ? isAutoTransaction(transaction) : false;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget));
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="t-h3">{isEdit ? t('transactions.form.editTitle') : t('transactions.form.addTitle')}</h2>
        <p className="text-sm text-text-muted mt-1">
          {isEdit ? t('transactions.form.editSubtitle') : t('transactions.form.addSubtitle')}
        </p>
      </div>

      {isAuto && (
        <InlineAlert tone="warning">
          {t('transactions.form.autoWarning')}
        </InlineAlert>
      )}

      {error && <InlineAlert tone="negative">{error}</InlineAlert>}

      <Field label={t('transactions.form.nameLabel')}>
        <Input name="name" defaultValue={transaction?.name || transaction?.notes || ''} placeholder={t('transactions.form.namePlaceholder')} required autoFocus />
      </Field>

      {!isEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('transactions.form.typeLabel')}>
            <Select name="type" defaultValue="EXPENSE">
              <option value="INCOME">{t('transactions.form.typeIncome')}</option>
              <option value="EXPENSE">{t('transactions.form.typeExpense')}</option>
            </Select>
          </Field>
          <Field label={t('transactions.form.catLabel')}>
            <Select name="categoryId" defaultValue="TOOLS">
              <option value="CLIENT">{t('transactions.form.catClient')}</option>
              <option value="PROJECT">{t('transactions.form.catProject')}</option>
              <option value="TOOLS">{t('transactions.form.catTools')}</option>
              <option value="OPERATIONS">{t('transactions.form.catOperations')}</option>
              <option value="TAXES">{t('transactions.form.catTaxes')}</option>
              <option value="OTHER">{t('transactions.form.catOther')}</option>
            </Select>
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('transactions.form.amountLabel')}>
          <Input name="amount" type="number" min="0" step="0.01" defaultValue={transaction?.amount} required prefix={<span dir="ltr">{currencyPrefix}</span>} />
        </Field>
        <Field label={t('transactions.form.dateLabel')}>
          <Input name="date" type="date" defaultValue={transaction?.date ? transaction.date.slice(0, 10) : today()} required={!isEdit} />
        </Field>
      </div>

      <Field label={t('transactions.form.notesLabel')} hint={t('transactions.form.notesHint')}>
        <Textarea name="notes" defaultValue={transaction?.notes || ''} placeholder={t('transactions.form.notesPlaceholder')} />
      </Field>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="ghost" disabled={isSaving} onClick={onCancel}>{t('transactions.form.cancel')}</Button>
        <Button type="submit" loading={isSaving}>{isSaving ? t('transactions.form.saving') : isEdit ? t('transactions.form.saveChanges') : t('transactions.form.saveTransaction')}</Button>
      </div>
    </form>
  );
}
