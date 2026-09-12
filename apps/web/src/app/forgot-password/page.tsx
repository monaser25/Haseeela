'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS,
  formatAuthWaitTime,
  getAuthEmailCooldownSeconds,
  getAuthErrorMessage,
  isAuthEmailRateLimited,
  setAuthEmailCooldown,
} from '@/lib/authEmailRateLimit';
import { useLocale } from '@/lib/i18n';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Icon } from '@/components/ui/Icon';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const { requestPasswordReset } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (!sentTo) return;
    const update = () => setWaitSeconds(getAuthEmailCooldownSeconds(sentTo));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [sentTo]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      setAuthEmailCooldown(email);
      setSentTo(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.forgotPassword.defaultError');
      if (isAuthEmailRateLimited(message)) setAuthEmailCooldown(email, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      // Always show a neutral success-like message to avoid account enumeration,
      // unless it's a rate-limit error worth surfacing.
      if (isAuthEmailRateLimited(message)) {
        setError(getAuthErrorMessage(message));
      } else {
        setSentTo(email);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="w-[56px] h-[56px] rounded-full bg-positive-tint text-positive-text flex items-center justify-center mb-5">
          <Icon name="mailCheck" size={26} />
        </div>
        <AuthHeader title={t('auth.forgotPassword.successTitle')} sub={t('auth.forgotPassword.successSubtitle')} />
        <Button
          variant="secondary"
          disabled={waitSeconds > 0 || isSubmitting}
          onClick={() => setSentTo(null)}
          className="w-full"
          icon="refreshCcw"
        >
          {waitSeconds > 0 ? t('auth.forgotPassword.resendAvailableIn', { time: formatAuthWaitTime(waitSeconds) }) : t('auth.forgotPassword.resendButton')}
        </Button>
        <div className="t-body text-text-secondary text-center mt-6">
          <Link href="/login" className="text-accent font-semibold hover:underline">{t('auth.forgotPassword.backToLoginLink')}</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeader title={t('auth.forgotPassword.title')} sub={t('auth.forgotPassword.subtitle')} />

      {error && <InlineAlert tone="negative" title={t('auth.forgotPassword.errorTitle')} body={error} className="mb-[18px]" />}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('auth.forgotPassword.emailLabel')}>
          <Input name="email" type="email" placeholder={t('auth.forgotPassword.emailPlaceholder')} required autoFocus />
        </Field>
        <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-1">
          {isSubmitting ? t('auth.forgotPassword.submitButtonLoading') : t('auth.forgotPassword.submitButton')}
        </Button>
      </form>

      <div className="t-body text-text-secondary text-center mt-6">
        {t('auth.forgotPassword.backToLoginPrompt')} <Link href="/login" className="text-accent font-semibold hover:underline">{t('auth.forgotPassword.backToLoginLink')}</Link>
      </div>
    </AuthLayout>
  );
}
