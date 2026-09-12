'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { isDevAuthEnabled } from '@/lib/devAuth';
import { loadPreferencesAPI, updatePreferencesAPI, deleteAccountAPI } from '@/services/financialApi';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Field, Input, StrengthMeter, strength } from '@/components/ui/Form';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useToast } from '@/components/ui/Toast';
import { useLocale } from '@/lib/i18n';

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useLocale();
  const dev = isDevAuthEnabled();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Email change requires the current password to confirm identity.
  const [emailCurrentPw, setEmailCurrentPw] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  // The address the confirmation links were sent to (drives the success banner).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Password change requires the current password.
  const [currentPw, setCurrentPw] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Delete requires re-entering the password.
  const [confirmDel, setConfirmDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPreferencesAPI()
      .then((p) => { setName(p.name || ''); setEmail(p.email || ''); })
      .catch(() => {
        setName((user?.user_metadata?.name as string) || '');
        setEmail(user?.email || '');
      });
  }, [user]);

  // Re-authenticate the user by their current password (Supabase has no
  // dedicated verify endpoint, so a sign-in serves as the check).
  const verifyPassword = async (password: string) => {
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: user?.email || '',
      password,
    });
    if (error) throw new Error(t('profile.error.currentPassword'));
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await updatePreferencesAPI({ name: name.trim() });
      if (!dev) await getSupabaseBrowserClient().auth.updateUser({ data: { name: name.trim() } });
      toast(t('profile.toast.nameUpdated'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('profile.toast.nameFailed'), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const saveEmail = async () => {
    if (!email.trim() || email === user?.email) return;
    if (dev) { toast(t('profile.toast.devEmail'), 'info'); return; }
    if (!emailCurrentPw) { toast(t('profile.toast.reqCurrentPassword'), 'error'); return; }
    setSavingEmail(true);
    try {
      await verifyPassword(emailCurrentPw);
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ email: email.trim() });
      if (error) throw error;
      setEmailCurrentPw('');
      setPendingEmail(email.trim());
      toast(t('profile.toast.emailLinksSent'), 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('profile.toast.emailFailed'), 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async () => {
    if (dev) { toast(t('profile.toast.devPassword'), 'info'); return; }
    if (!currentPw) { toast(t('profile.toast.reqPassword'), 'error'); return; }
    if (pw.length < 8) { toast(t('profile.toast.passwordLength'), 'error'); return; }
    if (pw !== pw2) { toast(t('profile.toast.passwordMismatch'), 'error'); return; }
    setSavingPw(true);
    try {
      await verifyPassword(currentPw);
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password: pw });
      if (error) throw error;
      setCurrentPw(''); setPw(''); setPw2('');
      toast(t('profile.toast.passwordUpdated'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('profile.toast.passwordFailed'), 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const doDelete = async () => {
    if (!dev && !delPw) { toast(t('profile.toast.reqConfirmPassword'), 'error'); return; }
    setDeleting(true);
    try {
      if (!dev) await verifyPassword(delPw);
      await deleteAccountAPI();
      await signOut().catch(() => undefined);
      router.replace('/login');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('profile.toast.deleteFailed'), 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Avatar name={name || email} size={48} />
        <div>
          <h1 className="t-h1">{name || t('profile.title')}</h1>
          <p className="t-body text-text-muted"><span dir="ltr">{email}</span></p>
        </div>
      </div>

      {/* Personal info */}
      <Card pad={20}>
        <SectionHeader title={t('profile.section.personal')} />
        <div className="flex flex-col gap-4">
          <Field label={t('profile.label.name')}>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
              <Button variant="secondary" loading={savingName} onClick={saveName}>{t('profile.action.save')}</Button>
            </div>
          </Field>
          <Field
            label={t('profile.label.email')}
            hint={dev
              ? t('profile.hint.devDisabled')
              : t('profile.hint.emailChange')}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setPendingEmail(null); }}
              disabled={dev}
              dir="ltr"
            />
          </Field>
          {!dev && pendingEmail && (
            <InlineAlert
              tone="info"
              title={t('profile.alert.emailConfirmTitle')}
              body={
                <>
                  {t('profile.alert.emailConfirmBody1')}
                  <span dir="ltr">{user?.email || ''}</span>
                  {t('profile.alert.emailConfirmBody2')}
                  <span dir="ltr">{pendingEmail}</span>
                  {t('profile.alert.emailConfirmBody3')}
                </>
              }
            />
          )}
          {!dev && email !== user?.email && email.trim() && (
            <Field label={t('profile.label.currentPassword')}>
              <div className="flex gap-2">
                <PasswordInput value={emailCurrentPw} onChange={(e) => setEmailCurrentPw(e.target.value)} className="flex-1" placeholder={t('profile.placeholder.confirmIdentity')} />
                <Button variant="secondary" loading={savingEmail} disabled={!emailCurrentPw} onClick={saveEmail}>{t('profile.action.updateEmail')}</Button>
              </div>
            </Field>
          )}
        </div>
      </Card>

      {/* Password */}
      <Card pad={20}>
        <SectionHeader title={t('profile.section.password')} sub={dev ? t('profile.hint.devDisabled') : t('profile.section.passwordSub')} />
        <div className="flex flex-col gap-4">
          <Field label={t('profile.label.currentPassword')}>
            <PasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} disabled={dev} autoComplete="current-password" />
          </Field>
          <Field label={t('profile.label.newPassword')} hint={t('profile.hint.minChars')}>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} disabled={dev} autoComplete="new-password" />
            {pw && <div className="mt-2"><StrengthMeter value={pw} /></div>}
          </Field>
          <Field label={t('profile.label.confirmPassword')} error={pw2 && pw2 !== pw ? t('profile.error.passwordMismatch') : undefined}>
            <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={dev} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end">
            <Button loading={savingPw} disabled={dev || !currentPw || strength(pw) < 2 || pw !== pw2} onClick={savePassword}>{t('profile.action.updatePassword')}</Button>
          </div>
        </div>
      </Card>

      {/* Danger zone */}
      <Card pad={20} className="border-negative/40">
        <SectionHeader title={t('profile.section.delete')} sub={t('profile.section.deleteSub')} />
        <Button variant="destructive" icon="trash2" onClick={() => { setDelPw(''); setConfirmDel(true); }}>{t('profile.action.deleteAccount')}</Button>
      </Card>

      <Modal
        open={confirmDel}
        onClose={() => !deleting && setConfirmDel(false)}
        dismissable={!deleting}
        maxWidth={460}
      >
        <div className="flex flex-col items-center text-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-full bg-negative-tint text-negative-text flex items-center justify-center">
            <Icon name="alertTriangle" size={24} />
          </div>
          <h2 className="t-h3">{t('profile.modal.deleteTitle')}</h2>
          <p className="t-body text-text-secondary max-w-[360px]">
            {t('profile.modal.deleteBody')}
          </p>
        </div>
        {!dev && (
          <div className="mt-4">
            <Field label={t('profile.modal.passwordLabel')}>
              <PasswordInput value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder={t('profile.modal.passwordPlaceholder')} autoFocus />
            </Field>
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-2 pt-5">
          <Button variant="secondary" disabled={deleting} onClick={() => setConfirmDel(false)}>{t('profile.action.cancel')}</Button>
          <Button variant="destructive" loading={deleting} disabled={!dev && !delPw} onClick={doDelete}>{t('profile.action.deleteEverything')}</Button>
        </div>
      </Modal>
    </div>
  );
}
