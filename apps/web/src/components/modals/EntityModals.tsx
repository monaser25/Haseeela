'use client';

import { useMemo, useState } from 'react';
import { useFinancialStore } from '@/store/financialStore';
import { computeNextBillingDate } from '@/store/financialStore';
import { useUiStore } from '@/store/uiStore';
import { Client, Subscription, Transaction } from '@/types/finance';
import { makeCompactCurrencyFormatter } from '@/lib/currency';
import { useLocale, translateError } from '@/lib/i18n';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea, Segmented } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const toIsoDate = (date: string) => new Date(`${date}T12:00:00`).toISOString();

/**
 * Global "New …" modal host. Driven by the UI store so the topbar "+ New"
 * dropdown, the command palette, and the sidebar can all open the same forms
 * from anywhere in the app.
 */
export function EntityModals() {
  const { newModal, closeNewModal } = useUiStore();
  const { addTransaction, addClient, addSubscription, currency } = useFinancialStore();
  const { t, locale } = useLocale();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = useMemo(() => makeCompactCurrencyFormatter(currency, { minimumFractionDigits: 2 }, locale), [currency, locale]);
  const currencyPrefix = useMemo(
    () => money.formatToParts(0).find((p) => p.type === 'currency')?.value || currency,
    [currency, money],
  );

  const close = () => {
    if (isSaving) return;
    setError(null);
    closeNewModal();
  };

  const isTx = newModal === 'income' || newModal === 'expense';
  const txType: 'INCOME' | 'EXPENSE' = newModal === 'expense' ? 'EXPENSE' : 'INCOME';

  const saveTransaction = async (form: FormData) => {
    const amount = Number(form.get('amount'));
    const name = String(form.get('name') || '').trim();
    if (!name || !amount || amount <= 0) {
      setError(t('modals.error.nameAmount'));
      return;
    }
    const tx: Transaction = {
      id: makeId(),
      name,
      amount,
      type: txType,
      status: 'COMPLETED',
      date: toIsoDate(String(form.get('date') || today())),
      notes: String(form.get('notes') || '').trim(),
      sourceType: 'manual',
      categoryId: String(form.get('categoryId') || (txType === 'INCOME' ? 'CLIENT' : 'TOOLS')),
    };
    setIsSaving(true);
    setError(null);
    try {
      await addTransaction(tx);
      toast(txType === 'INCOME' ? t('modals.toast.revenueAdded') : t('modals.toast.expenseLogged'));
      closeNewModal();
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, t) : t('modals.error.saveTx'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveClient = async (form: FormData, paymentType: Client['paymentType']) => {
    const name = String(form.get('name') || '').trim();
    const revenue = Number(form.get('revenue') || 0);
    if (!name || revenue <= 0) {
      setError(t('modals.error.nameAmount'));
      return;
    }
    const nextBillingDate =
      paymentType === 'retainer'
        ? String(form.get('nextBillingDate') || computeNextBillingDate(new Date().getDate()))
        : undefined;
    setIsSaving(true);
    setError(null);
    try {
      await addClient({
        id: makeId(),
        name,
        company: String(form.get('company') || '').trim(),
        email: String(form.get('email') || '').trim(),
        revenue,
        clientType: String(form.get('clientType') || 'COMPANY') as Client['clientType'],
        status: 'ACTIVE',
        paymentType,
        paymentDate: paymentType === 'onetime' ? String(form.get('paymentDate') || today()) : undefined,
        billingDay: nextBillingDate
          ? Math.max(1, Math.min(28, new Date(`${nextBillingDate}T12:00:00`).getDate()))
          : undefined,
        nextBillingDate,
        recorded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast(t('modals.toast.clientAdded'));
      closeNewModal();
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, t) : t('modals.error.saveClient'));
    } finally {
      setIsSaving(false);
    }
  };

  const saveSubscription = async (form: FormData) => {
    const name = String(form.get('name') || '').trim();
    const amount = Number(form.get('amount') || 0);
    const cycle = String(form.get('billingCycle') || 'MONTHLY') as Subscription['cycle'];
    const nextBillingDate = String(form.get('nextBillingDate') || computeNextBillingDate(new Date().getDate()));
    if (!name || amount <= 0) {
      setError(t('modals.error.nameAmount'));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await addSubscription({
        id: makeId(),
        name,
        amount,
        cycle,
        billingCycle: cycle,
        notes: String(form.get('notes') || '').trim(),
        billingDay: Math.max(1, Math.min(28, new Date(`${nextBillingDate}T12:00:00`).getDate())),
        nextBillingDate,
        status: 'ACTIVE',
      });
      toast(t('modals.toast.subAdded'));
      closeNewModal();
    } catch (err) {
      setError(err instanceof Error ? translateError(err.message, t) : t('modals.error.saveSub'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!newModal) return null;

  if (isTx) {
    return (
      <Modal
        open
        onClose={close}
        dismissable={!isSaving}
        title={txType === 'INCOME' ? t('dashboard.forms.income.title') : t('dashboard.forms.expense.title')}
        description={
          txType === 'INCOME' ? t('dashboard.forms.income.subtitle') : t('dashboard.forms.expense.subtitle')
        }
      >
        <TransactionForm type={txType} prefix={currencyPrefix} error={error} saving={isSaving} onCancel={close} onSave={saveTransaction} t={t} />
      </Modal>
    );
  }
  if (newModal === 'client') {
    return (
      <Modal open onClose={close} dismissable={!isSaving} title={t('dashboard.forms.client.title')} description={t('dashboard.forms.client.subtitle')} maxWidth={520}>
        <ClientForm prefix={currencyPrefix} error={error} saving={isSaving} onCancel={close} onSave={saveClient} t={t} />
      </Modal>
    );
  }
  return (
    <Modal open onClose={close} dismissable={!isSaving} title={t('dashboard.forms.sub.title')} description={t('dashboard.forms.sub.subtitle')}>
      <SubscriptionForm prefix={currencyPrefix} error={error} saving={isSaving} onCancel={close} onSave={saveSubscription} t={t} />
    </Modal>
  );
}

function TransactionForm({
  type,
  prefix,
  error,
  saving,
  onCancel,
  onSave,
  t,
}: {
  type: 'INCOME' | 'EXPENSE';
  prefix: string;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormData) => void;
  t: any;
}) {
  const cats = type === 'INCOME' 
    ? [
        { value: 'CLIENT', label: t('dashboard.forms.tx.catClient') },
        { value: 'PROJECT', label: t('dashboard.forms.tx.catProject') },
        { value: 'OTHER', label: t('dashboard.forms.tx.catOtherIncome') },
      ]
    : [
        { value: 'TOOLS', label: t('dashboard.forms.tx.catTools') },
        { value: 'OPERATIONS', label: t('dashboard.forms.tx.catOps') },
        { value: 'TAXES', label: t('dashboard.forms.tx.catTaxes') },
        { value: 'OTHER', label: t('dashboard.forms.tx.catOtherExpense') },
      ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="flex flex-col gap-4">
      {error && <p className="t-small text-negative-text">{error}</p>}
      <Field label={t('dashboard.forms.tx.nameLabel')}>
        <Input name="name" placeholder={type === 'INCOME' ? t('dashboard.forms.tx.nameIncomePlaceholder') : t('dashboard.forms.tx.nameExpensePlaceholder')} required autoFocus />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.tx.amountLabel')}><Input name="amount" type="number" min="0" step="0.01" required prefix={<span dir="ltr">{prefix}</span>} /></Field>
        <Field label={t('dashboard.forms.tx.dateLabel')}><Input name="date" type="date" defaultValue={today()} required /></Field>
      </div>
      <Field label={t('dashboard.forms.tx.categoryLabel')}>
        <Select name="categoryId">
          {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </Field>
      <Field label={t('dashboard.forms.tx.notesLabel')}><Input name="notes" placeholder={t('dashboard.forms.tx.notesPlaceholder')} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>{t('dashboard.forms.cancel')}</Button>
        <Button type="submit" loading={saving}>{t('dashboard.forms.tx.save')}</Button>
      </div>
    </form>
  );
}

function ClientForm({
  prefix,
  error,
  saving,
  onCancel,
  onSave,
  t,
}: {
  prefix: string;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormData, paymentType: Client['paymentType']) => void;
  t: any;
}) {
  const [paymentType, setPaymentType] = useState<Client['paymentType']>('onetime');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget), paymentType); }} className="flex flex-col gap-4">
      {error && <p className="t-small text-negative-text">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.client.nameLabel')}><Input name="name" required autoFocus /></Field>
        <Field label={t('dashboard.forms.client.amountLabel')}><Input name="revenue" type="number" min="0" step="0.01" required prefix={<span dir="ltr">{prefix}</span>} /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.client.companyLabel')}><Input name="company" /></Field>
        <Field label={t('dashboard.forms.client.emailLabel')}><Input name="email" type="email" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.client.typeLabel')}>
          <Select name="clientType" defaultValue="COMPANY">
            <option value="COMPANY">{t('dashboard.forms.client.typeCompany')}</option>
            <option value="INDIVIDUAL">{t('dashboard.forms.client.typeIndividual')}</option>
          </Select>
        </Field>
        <Field label={t('dashboard.forms.client.paymentTypeLabel')}>
          <Select name="paymentType" value={paymentType} onChange={(e) => setPaymentType(e.target.value as Client['paymentType'])}>
            <option value="onetime">{t('dashboard.forms.client.paymentOneTime')}</option>
            <option value="retainer">{t('dashboard.forms.client.paymentRetainer')}</option>
          </Select>
        </Field>
      </div>
      {paymentType === 'retainer' ? (
        <Field label={t('dashboard.forms.client.nextBillingLabel')}><Input name="nextBillingDate" type="date" defaultValue={computeNextBillingDate(new Date().getDate())} required /></Field>
      ) : (
        <Field label={t('dashboard.forms.client.paymentDateLabel')}><Input name="paymentDate" type="date" defaultValue={today()} required /></Field>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>{t('dashboard.forms.cancel')}</Button>
        <Button type="submit" loading={saving}>{t('dashboard.forms.client.save')}</Button>
      </div>
    </form>
  );
}

function SubscriptionForm({
  prefix,
  error,
  saving,
  onCancel,
  onSave,
  t,
}: {
  prefix: string;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormData) => void;
  t: any;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="flex flex-col gap-4">
      {error && <p className="t-small text-negative-text">{error}</p>}
      <Field label={t('dashboard.forms.sub.nameLabel')}><Input name="name" placeholder={t('dashboard.forms.sub.namePlaceholder')} required autoFocus /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('dashboard.forms.sub.costLabel')}><Input name="amount" type="number" min="0" step="0.01" required prefix={<span dir="ltr">{prefix}</span>} /></Field>
        <Field label={t('dashboard.forms.sub.nextBillingLabel')}><Input name="nextBillingDate" type="date" defaultValue={computeNextBillingDate(new Date().getDate())} required /></Field>
      </div>
      <Field label={t('dashboard.forms.sub.cycleLabel')}>
        <Select name="billingCycle" defaultValue="MONTHLY">
          <option value="MONTHLY">{t('dashboard.forms.sub.cycleMonthly')}</option>
          <option value="QUARTERLY">{t('dashboard.forms.sub.cycleQuarterly')}</option>
          <option value="YEARLY">{t('dashboard.forms.sub.cycleYearly')}</option>
        </Select>
      </Field>
      <Field label={t('dashboard.forms.sub.notesLabel')}><Textarea name="notes" placeholder={t('dashboard.forms.sub.notesPlaceholder')} rows={2} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>{t('dashboard.forms.cancel')}</Button>
        <Button type="submit" loading={saving}>{t('dashboard.forms.sub.save')}</Button>
      </div>
    </form>
  );
}
