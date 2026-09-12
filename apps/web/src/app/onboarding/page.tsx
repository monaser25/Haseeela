'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useFinancialStore, computeNextBillingDate } from '@/store/financialStore';
import { supportedCurrencies, makeCompactCurrencyFormatter } from '@/lib/currency';
import { useLocale } from '@/lib/i18n';
import { CurrencyCode, Client, Subscription } from '@/types/finance';
import { markOnboarded } from '@/lib/onboarding';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function OnboardingPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user, isLoading } = useAuth();
  const { currency, setCurrency, setStorageUserId, addClient, addSubscription } = useFinancialStore();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [createdClient, setCreatedClient] = useState(false);
  const [createdSub, setCreatedSub] = useState(false);

  const steps = [
    t('onboarding.steps.welcome'),
    t('onboarding.steps.currency'),
    t('onboarding.steps.first_client'),
    t('onboarding.steps.first_tool'),
    t('onboarding.steps.done')
  ];

  const displayName = (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || t('onboarding.welcome.fallback_name');

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    setStorageUserId(user.id);
  }, [isLoading, user, router, setStorageUserId]);

  const money = useMemo(() => makeCompactCurrencyFormatter(currency, { maximumFractionDigits: 0 }, locale), [currency, locale]);
  const prefix = useMemo(() => money.formatToParts(0).find((p) => p.type === 'currency')?.value || currency, [currency, money]);

  const finish = () => {
    if (user) markOnboarded(user.id);
    router.replace('/');
  };

  const saveClient = async (form: FormData) => {
    const name = String(form.get('name') || '').trim();
    const revenue = Number(form.get('revenue') || 0);
    if (!name || revenue <= 0) return;
    const paymentType = String(form.get('paymentType') || 'onetime') as Client['paymentType'];
    setBusy(true);
    try {
      await addClient({
        id: makeId(),
        name,
        revenue,
        clientType: 'COMPANY',
        status: 'ACTIVE',
        paymentType,
        paymentDate: paymentType === 'onetime' ? today() : undefined,
        nextBillingDate: paymentType === 'retainer' ? computeNextBillingDate(new Date().getDate()) : undefined,
        billingDay: paymentType === 'retainer' ? new Date().getDate() : undefined,
        recorded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setCreatedClient(true);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const saveSubscription = async (form: FormData) => {
    const name = String(form.get('name') || '').trim();
    const amount = Number(form.get('amount') || 0);
    if (!name || amount <= 0) return;
    const cycle = String(form.get('billingCycle') || 'MONTHLY') as Subscription['cycle'];
    setBusy(true);
    try {
      await addSubscription({
        id: makeId(),
        name,
        amount,
        cycle,
        billingCycle: cycle,
        billingDay: new Date().getDate(),
        nextBillingDate: computeNextBillingDate(new Date().getDate()),
        status: 'ACTIVE',
      });
      setCreatedSub(true);
      setStep(4);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-text-muted text-[13px]">{t('onboarding.loading')}</div>;
  }

  return (
    <div className="min-h-screen flex bg-background text-text">
      {/* Progress rail */}
      <aside className="fl-ob-rail hidden md:flex w-[280px] flex-col justify-between p-10 border-r border-border bg-surface">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-[9px] bg-accent flex items-center justify-center shadow-[0_2px_8px_color-mix(in_srgb,var(--accent)_40%,transparent)]">
            <Icon name="wallet" size={18} className="text-white" />
          </div>
          <span className="brand-wordmark tracking-[-0.02em]">{t('brand.name')}</span>
        </div>
        <ol className="flex flex-col gap-1">
          {steps.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={i} className="flex items-center gap-3 py-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
                    done ? 'bg-positive text-white' : active ? 'bg-accent text-accent-fg' : 'bg-surface-hover text-text-muted'
                  }`}
                >
                  {done ? <Icon name="check" size={15} /> : i + 1}
                </span>
                <span className={`t-body-m ${active ? 'text-text' : 'text-text-muted'}`}>{label}</span>
              </li>
            );
          })}
        </ol>
        <div className="t-small text-text-muted">{t('onboarding.progress.step', { step: String(step + 1), total: String(steps.length) })}</div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[440px]">
          {step === 0 && (
            <Step title={t('onboarding.welcome.title', { name: displayName })} sub={t('onboarding.welcome.sub')}>
              <Button size="lg" className="w-full" onClick={() => setStep(1)} iconRight="arrowRight">{t('onboarding.welcome.start')}</Button>
            </Step>
          )}

          {step === 1 && (
            <Step title={t('onboarding.currency.title')} sub={t('onboarding.currency.sub')}>
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {supportedCurrencies.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code as CurrencyCode)}
                    className={`h-12 rounded-md border text-left px-4 t-body-m transition-colors focus-ring ${
                      currency === c.code ? 'border-accent bg-accent-tint text-accent' : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(0)}>{t('onboarding.currency.back')}</Button>
                <Button className="flex-1" onClick={() => setStep(2)} iconRight="arrowRight">{t('onboarding.currency.continue')}</Button>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step title={t('onboarding.client.title')} sub={t('onboarding.client.sub')}>
              <form onSubmit={(e) => { e.preventDefault(); saveClient(new FormData(e.currentTarget)); }} className="flex flex-col gap-4">
                <Field label={t('onboarding.client.name_label')}><Input name="name" placeholder={t('onboarding.client.name_placeholder')} required autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('onboarding.client.amount_label')}><Input name="revenue" type="number" min="0" step="0.01" required prefix={prefix} /></Field>
                  <Field label={t('onboarding.client.payment_type_label')}>
                    <Select name="paymentType" defaultValue="onetime">
                      <option value="onetime">{t('onboarding.client.payment_type_onetime')}</option>
                      <option value="retainer">{t('onboarding.client.payment_type_retainer')}</option>
                    </Select>
                  </Field>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep(3)}>{t('onboarding.client.skip')}</Button>
                  <Button type="submit" className="flex-1" loading={busy}>{t('onboarding.client.add')}</Button>
                </div>
              </form>
            </Step>
          )}

          {step === 3 && (
            <Step title={t('onboarding.tool.title')} sub={t('onboarding.tool.sub')}>
              <form onSubmit={(e) => { e.preventDefault(); saveSubscription(new FormData(e.currentTarget)); }} className="flex flex-col gap-4">
                <Field label={t('onboarding.tool.name_label')}><Input name="name" placeholder={t('onboarding.tool.name_placeholder')} required autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('onboarding.tool.cost_label')}><Input name="amount" type="number" min="0" step="0.01" required prefix={prefix} /></Field>
                  <Field label={t('onboarding.tool.cycle_label')}>
                    <Select name="billingCycle" defaultValue="MONTHLY">
                      <option value="MONTHLY">{t('onboarding.tool.cycle_monthly')}</option>
                      <option value="QUARTERLY">{t('onboarding.tool.cycle_quarterly')}</option>
                      <option value="YEARLY">{t('onboarding.tool.cycle_yearly')}</option>
                    </Select>
                  </Field>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setStep(4)}>{t('onboarding.tool.skip')}</Button>
                  <Button type="submit" className="flex-1" loading={busy}>{t('onboarding.tool.add')}</Button>
                </div>
              </form>
            </Step>
          )}

          {step === 4 && (
            <Step title={t('onboarding.done.title')} sub={t('onboarding.done.sub')}>
              <div className="flex flex-col gap-2 mb-6">
                <Summary ok label={t('onboarding.done.summary_currency')} detail={currency} />
                <Summary ok={createdClient} label={t('onboarding.done.summary_client')} detail={createdClient ? t('onboarding.done.summary_added') : t('onboarding.done.summary_skipped')} />
                <Summary ok={createdSub} label={t('onboarding.done.summary_tool')} detail={createdSub ? t('onboarding.done.summary_added') : t('onboarding.done.summary_skipped')} />
              </div>
              <Button size="lg" className="w-full" onClick={finish} iconRight="arrowRight">{t('onboarding.done.finish')}</Button>
            </Step>
          )}
        </div>
      </main>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="anim-rise">
      <h1 className="t-h1 mb-2">{title}</h1>
      <p className="t-body text-text-secondary mb-7">{sub}</p>
      {children}
    </div>
  );
}

function Summary({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-surface">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${ok ? 'bg-positive-tint text-positive-text' : 'bg-surface-hover text-text-muted'}`}>
        <Icon name={ok ? 'check' : 'minus'} size={14} />
      </span>
      <span className="t-body-m flex-1">{label}</span>
      <span className="t-small text-text-muted">{detail}</span>
    </div>
  );
}
