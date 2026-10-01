'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createIsolatedSupabaseClient, getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { logAuth, describeUser } from '@/lib/authDebug';
import { getAuthErrorMessage } from '@/lib/authEmailRateLimit';
import { useLocale } from '@/lib/i18n';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Field, StrengthMeter, strength } from '@/components/ui/Form';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Icon } from '@/components/ui/Icon';

type Status = 'verifying' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The recovery session is held ONLY inside this isolated, non-persistent
  // client. It is never written to the shared app session, so the user is never
  // treated as "logged in" until they submit a new password and sign in fresh.
  const recoveryClient = useRef<SupabaseClient | null>(null);
  // Guard against React StrictMode double-invoking the effect, which would
  // otherwise consume the single-use recovery token twice and fail.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      logAuth('reset:start', { href: window.location.href.split('#')[0] });

      // 1. Clear ANY existing app session before handling the reset. A stale
      //    session from a previously logged-in account must never be mistaken
      //    for the recovery session. `scope: 'local'` clears storage without a
      //    network round-trip (and without failing on an already-invalid token).
      try {
        await getSupabaseBrowserClient().auth.signOut({ scope: 'local' });
        logAuth('reset:cleared-existing-session');
      } catch {
        // Best-effort: even if there was nothing to clear, continue.
      }

      const isolated = createIsolatedSupabaseClient();
      recoveryClient.current = isolated;

      try {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
        const hashParams = new URLSearchParams(hash);
        const search = new URLSearchParams(window.location.search);

        if (search.get('error_description') || hashParams.get('error_description')) {
          logAuth('reset:invalid', { reason: 'error_description in url' });
          setStatus('invalid');
          return;
        }

        // The token type must be a recovery token. If a signup/magiclink token
        // somehow lands here, refuse it rather than resetting the wrong flow.
        const type = hashParams.get('type') || search.get('type');
        if (type && type !== 'recovery') {
          logAuth('reset:invalid', { reason: 'wrong token type', type });
          setStatus('invalid');
          return;
        }

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenHash = search.get('token_hash') || hashParams.get('token_hash');
        const code = search.get('code');

        if (tokenHash) {
          // Modern, email-bound token-hash format. verifyOtp binds the session
          // to the exact account the recovery email was issued for.
          const { error: e } = await isolated.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
          if (e) throw e;
        } else if (accessToken && refreshToken) {
          // Legacy implicit format: tokens delivered in the URL hash.
          const { error: e } = await isolated.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (e) throw e;
        } else if (code) {
          // PKCE format.
          const { error: e } = await isolated.auth.exchangeCodeForSession(code);
          if (e) throw e;
        } else {
          // CRITICAL: never fall back to an existing/persisted session here.
          // No recovery token in the URL means this is not a valid reset.
          logAuth('reset:invalid', { reason: 'no recovery token in url' });
          setStatus('invalid');
          return;
        }

        // Confirm we have a recovery session bound to a real account, and show
        // the user exactly which account they are resetting.
        const { data: userData, error: userError } = await isolated.auth.getUser();
        if (userError || !userData.user) throw userError ?? new Error('No recovery user.');

        logAuth('reset:recovery-session-established', { user: describeUser(userData.user) });
        setAccountEmail(userData.user.email ?? null);

        // Strip the token out of the URL so it can't be re-read or shared.
        window.history.replaceState(null, '', '/reset-password');
        setStatus('ready');
      } catch (err) {
        logAuth('reset:invalid', { reason: 'token exchange failed', message: err instanceof Error ? err.message : String(err) });
        setStatus('invalid');
      }
    };

    run();
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t('auth.resetPassword.passwordErrorLength'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.resetPassword.confirmErrorMatch'));
      return;
    }

    const isolated = recoveryClient.current;
    if (!isolated) {
      setStatus('invalid');
      return;
    }

    setIsSubmitting(true);
    try {
      // updateUser({ password }) runs ONLY here, after the user submits, and
      // ONLY against the isolated recovery client.
      logAuth('reset:update-password:start', { email: accountEmail });
      const { error: e } = await isolated.auth.updateUser({ password });
      if (e) throw e;

      // Tear down the recovery session entirely. The user must now log in
      // fresh with their new password - they are never auto-logged-in here.
      await isolated.auth.signOut({ scope: 'local' });
      logAuth('reset:update-password:success', { email: accountEmail });

      setStatus('done');
      setTimeout(() => router.replace('/login?reset=1'), 1500);
    } catch (err) {
      logAuth('reset:update-password:error', { message: err instanceof Error ? err.message : String(err) });
      setError(getAuthErrorMessage(err instanceof Error ? err.message : t('auth.resetPassword.defaultError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'verifying') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4 py-10">
          <span className="spinner w-7 h-7 text-accent" />
          <p className="t-body text-text-secondary">{t('auth.resetPassword.verifying')}</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthLayout>
        <div className="w-[56px] h-[56px] rounded-full bg-negative-tint text-negative-text flex items-center justify-center mb-5">
          <Icon name="alertTriangle" size={26} />
        </div>
        <AuthHeader title={t('auth.resetPassword.invalidTitle')} sub={t('auth.resetPassword.invalidSubtitle')} />
        <Button onClick={() => router.push('/forgot-password')} size="lg" className="w-full">
          {t('auth.resetPassword.requestNewLink')}
        </Button>
        <div className="t-body text-text-secondary text-center mt-6">
          <Link href="/login" className="text-accent font-semibold hover:underline">{t('auth.resetPassword.backToLoginLink')}</Link>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'done') {
    return (
      <AuthLayout>
        <div className="w-[56px] h-[56px] rounded-full bg-positive-tint text-positive-text flex items-center justify-center mb-5">
          <Icon name="checkCircle" size={26} />
        </div>
        <AuthHeader title={t('auth.resetPassword.doneTitle')} sub={t('auth.resetPassword.doneSubtitle')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeader
        title={t('auth.resetPassword.title')}
        sub={accountEmail
          ? t('auth.resetPassword.subtitleAccount', { email: accountEmail })
          : t('auth.resetPassword.subtitleDefault')}
      />

      {error && <InlineAlert tone="negative" title={t('auth.resetPassword.errorTitle')} body={error} className="mb-[18px]" />}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t('auth.resetPassword.passwordLabel')} hint={t('auth.resetPassword.passwordHint')}>
          <PasswordInput name="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && <div className="mt-2"><StrengthMeter value={password} /></div>}
        </Field>
        <Field label={t('auth.resetPassword.confirmLabel')} error={confirm && confirm !== password ? t('auth.resetPassword.confirmErrorMatch') : undefined}>
          <PasswordInput name="confirm" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-1" disabled={strength(password) < 2}>
          {isSubmitting ? t('auth.resetPassword.submitButtonLoading') : t('auth.resetPassword.submitButton')}
        </Button>
      </form>
    </AuthLayout>
  );
}
