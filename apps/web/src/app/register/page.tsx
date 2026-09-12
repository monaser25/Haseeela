'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS,
  formatAuthWaitTime,
  getAuthEmailCooldownMessage,
  getAuthEmailCooldownSeconds,
  getAuthErrorMessage,
  isAuthEmailRateLimited,
  setAuthEmailCooldown,
} from '@/lib/authEmailRateLimit';
import { isDevAuthEnabled } from '@/lib/devAuth';
import { useLocale } from '@/lib/i18n';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Field, Input, StrengthMeter } from '@/components/ui/Form';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Icon } from '@/components/ui/Icon';

const isEmailNotConfirmed = (message: string) => message.toLowerCase().includes('email not confirmed');

export default function RegisterPage() {
  const { t } = useLocale();
  const { signUp, resendConfirmation } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendWaitSeconds, setResendWaitSeconds] = useState(0);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!confirmationEmail) {
      setResendWaitSeconds(0);
      return;
    }

    const updateCooldown = () => setResendWaitSeconds(getAuthEmailCooldownSeconds(confirmationEmail));
    updateCooldown();
    const intervalId = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(intervalId);
  }, [confirmationEmail]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setConfirmationEmail(null);
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const submittedPassword = String(formData.get('password') || password);
    const cooldownSeconds = getAuthEmailCooldownSeconds(email);

    if (!isDevAuthEnabled() && cooldownSeconds > 0) {
      setConfirmationEmail(email);
      setError(getAuthEmailCooldownMessage(cooldownSeconds));
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email, submittedPassword, name);
      setAuthEmailCooldown(email);
      setConfirmationEmail(email);
      setNotice(t('auth.register.notice.check_email'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.register.error.default');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(email, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
        setConfirmationEmail(email);
      }
      setError(isEmailNotConfirmed(message)
        ? t('auth.login.error.email_not_confirmed')
        : getAuthErrorMessage(message));
      if (isEmailNotConfirmed(message)) setConfirmationEmail(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendConfirmation = async () => {
    if (!confirmationEmail) return;
    const cooldownSeconds = getAuthEmailCooldownSeconds(confirmationEmail);

    if (cooldownSeconds > 0) {
      setError(getAuthEmailCooldownMessage(cooldownSeconds));
      return;
    }

    setError(null);
    setNotice(null);
    setIsResending(true);

    try {
      await resendConfirmation(confirmationEmail);
      setAuthEmailCooldown(confirmationEmail);
      setNotice(t('auth.login.notice.resend_success', { email: confirmationEmail }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.login.error.resend_failed');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(confirmationEmail, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setError(getAuthErrorMessage(message));
    } finally {
      setIsResending(false);
    }
  };

  if (notice && !error) {
    return (
      <AuthLayout>
        <div className="w-[56px] h-[56px] rounded-full bg-positive-tint text-positive-text flex items-center justify-center mb-5">
          <Icon name="mail" size={26} />
        </div>
        <AuthHeader 
          title={t('auth.register.success.title')} 
          sub={t('auth.register.success.subtitle')} 
        />
        <Button 
          variant="secondary" 
          disabled={isResending || resendWaitSeconds > 0} 
          onClick={onResendConfirmation} 
          className="w-full mt-4" 
          icon="refreshCcw"
        >
          {isResending
            ? t('auth.login.action.sending')
            : resendWaitSeconds > 0
              ? t('auth.login.action.resend_in', { time: formatAuthWaitTime(resendWaitSeconds) })
              : t('auth.login.action.resend')}
        </Button>
        <div className="t-body text-text-secondary text-center mt-6">
          <Link href="/login" className="text-accent font-semibold hover:underline">{t('auth.register.success.return_login')}</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeader title={t('auth.register.title')} sub={t('auth.register.subtitle')} />
      
      {error && (
        <InlineAlert 
          tone={confirmationEmail && error.includes('confirm') ? "warning" : "negative"} 
          title={confirmationEmail && error.includes('confirm') ? t('auth.login.alert.confirm_title') : t('auth.register.alert.error_title')} 
          body={error}
          className="mb-[18px]"
        >
          {confirmationEmail && (
            <button
              type="button"
              onClick={onResendConfirmation}
              disabled={isResending || resendWaitSeconds > 0}
              className={`t-small font-semibold mt-2 ${resendWaitSeconds > 0 ? 'text-text-muted cursor-default' : 'text-accent hover:underline cursor-pointer'}`}
            >
              {isResending
                ? t('auth.login.action.sending')
                : resendWaitSeconds > 0
                  ? t('auth.login.action.resend_in', { time: formatAuthWaitTime(resendWaitSeconds) })
                  : t('auth.login.action.resend')}
            </button>
          )}
        </InlineAlert>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('auth.register.label.name')}>
          <Input name="name" type="text" placeholder={t('auth.register.placeholder.name')} required autoFocus />
        </Field>

        <Field label={t('auth.login.label.email')}>
          <Input name="email" type="email" placeholder={t('auth.login.placeholder.email')} required />
        </Field>

        <Field label={t('auth.login.label.password')} hint={t('auth.register.hint.password')}>
          <PasswordInput 
            name="password" 
            required 
            minLength={8} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password && <div className="mt-2"><StrengthMeter value={password} /></div>}
        </Field>

        <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-1">
          {isSubmitting ? t('auth.register.action.creating') : t('auth.register.action.create')}
        </Button>
      </form>

      <div className="t-body text-text-secondary text-center mt-6">
        {t('auth.register.text.already_have')} <Link href="/login" className="text-accent font-semibold hover:underline">{t('auth.login.action.login')}</Link>
      </div>
    </AuthLayout>
  );
}
