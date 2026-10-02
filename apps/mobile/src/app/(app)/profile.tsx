import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useAuth, getSupabaseClient } from '../../auth';
import { getSessionEpoch, getCurrentAuthUserId, enqueueAuthOp } from '../../auth/authScope';
import { usePreferences, useUpdatePreferences } from '../../api';
import { useIsOnline } from '../../query';
import { Button, Banner, TextField, ScreenContainer } from '../../components/ui';

export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'HU';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, isRTL } = useI18n();
  const { user, resetPassword } = useAuth();
  const isOnline = useIsOnline();

  const { data: preferences } = usePreferences();
  const updatePreferencesMutation = useUpdatePreferences();

  const initialName = user?.user_metadata?.name || preferences?.name || '';

  // Local form state
  const [nameInput, setNameInput] = useState(() => initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  // Synchronous operation lock and identity fences
  const activeOpRef = useRef<{ id: number; ownerId: string; epoch: number } | null>(null);
  const opSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Sync draft during render when owner changes or initial preferences become available
  const [prevOwnerId, setPrevOwnerId] = useState<string | undefined>(user?.id);
  const [hasInitializedFromPrefs, setHasInitializedFromPrefs] = useState(Boolean(initialName));

  if (user?.id !== prevOwnerId) {
    setPrevOwnerId(user?.id);
    setNameInput(initialName);
    setIsDirty(false);
    setHasInitializedFromPrefs(Boolean(initialName));
  } else if (!hasInitializedFromPrefs && initialName && !isDirty) {
    setNameInput(initialName);
    setHasInitializedFromPrefs(true);
  }

  // Reset ALL owner-bound state on actual identity change (from one user to another or logout)
  const prevUserRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevUserRef.current && prevUserRef.current !== user?.id) {
      activeOpRef.current = null;
      setIsSaving(false);
      setIsSendingReset(false);
      setNameError(null);
      setSuccessMessage(null);
      setErrorMessage(null);
      setSecurityMessage(null);
      setIsDirty(false);
      setNameInput(initialName);
    }
    prevUserRef.current = user?.id;
  }, [user?.id, initialName]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeOpRef.current = null;
    };
  }, []);

  const handleNameChange = (text: string) => {
    setNameInput(text);
    setIsDirty(true);
    setNameError(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const isBusy = Boolean(activeOpRef.current) || isSaving || isSendingReset || updatePreferencesMutation.isPending;

  const handleSave = async () => {
    if (activeOpRef.current !== null || !user?.id || !isOnline) return;

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError(t('profile.validation.nameRequired'));
      return;
    }

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };

    setIsSaving(true);
    setNameError(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    // Fence: this op still owns the lock, the screen is mounted, and owner + epoch are unchanged.
    const ownsLock = () => isMountedRef.current && activeOpRef.current?.id === opId;
    const isCurrent = () =>
      ownsLock() &&
      getSessionEpoch() === initiatingEpoch &&
      getCurrentAuthUserId() === initiatingOwnerId;
    // Release the lock and the saving flag only while this op still owns them. After an owner
    // change or unmount the identity-reset effect has already cleaned up, so nothing is touched.
    const release = () => {
      if (!ownsLock()) return;
      activeOpRef.current = null;
      setIsSaving(false);
    };
    // Surface an error only if the failure still belongs to the initiating owner.
    const fail = (message: string) => {
      if (isCurrent()) setErrorMessage(message);
      release();
    };

    // Step 0: Preflight verification against actual Supabase SDK session
    const client = getSupabaseClient();
    let preflightUserId: string | undefined;
    try {
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      if (!isCurrent()) {
        release();
        return;
      }
      preflightUserId = sessionErr ? undefined : sessionData?.session?.user?.id;
    } catch {
      fail(t('profile.toast.nameFailed'));
      return;
    }

    // Null session/user or a different SDK owner: zero SDK write
    if (preflightUserId !== initiatingOwnerId) {
      fail(t('profile.toast.nameFailed'));
      return;
    }

    // Step 1: Update Supabase auth user_metadata through the shared auth queue. The queued op can
    // start long after initiation, so owner/epoch are re-verified at execution time.
    try {
      const result = await enqueueAuthOp(async () => {
        if (!isCurrent()) return null;
        return client.auth.updateUser({ data: { name: trimmed } });
      });

      // Fence check after await: still mounted and still the same owner/epoch?
      if (!result || !isCurrent()) {
        release();
        return;
      }

      const { data, error: sdkError } = result;
      if (sdkError || !data?.user || data.user.id !== initiatingOwnerId) {
        fail(t('profile.toast.nameFailed'));
        return;
      }

      // Step 2: Update Preferences via PATCH /api/user/preferences
      try {
        await updatePreferencesMutation.mutateAsync({ name: trimmed });
      } catch {
        fail(t('profile.savePartial'));
        return;
      }

      if (isCurrent()) {
        setSuccessMessage(t('profile.toast.nameUpdated'));
        setErrorMessage(null);
        setIsDirty(false);
      }
      release();
    } catch {
      fail(t('profile.toast.nameFailed'));
    }
  };

  const handleResetPassword = async () => {
    if (activeOpRef.current !== null || !user?.email || !isOnline) return;

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };

    setIsSendingReset(true);
    setSecurityMessage(null);

    try {
      await resetPassword(user.email);
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setSecurityMessage({
          tone: 'success',
          text: t('profile.resetPasswordSuccess'),
        });
        setIsSendingReset(false);
        activeOpRef.current = null;
      }
    } catch {
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setSecurityMessage({
          tone: 'error',
          text: t('profile.resetPasswordError'),
        });
        setIsSendingReset(false);
        activeOpRef.current = null;
      }
    }
  };

  const initials = getInitials(nameInput || initialName, user?.email);

  return (
    <ScreenContainer testID="profile-screen" edges={['top', 'left', 'right']} scrollable={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="profile-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.currency.back')}
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
        >
          <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
            <ArrowLeft
              size={22}
              color={theme.colors.text}
            />
          </View>
        </Pressable>

        <Text
          accessibilityRole="header"
          style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}
        >
          {t('profile.title')}
        </Text>

        <Pressable
          testID="profile-save-button"
          accessibilityRole="button"
          accessibilityLabel={t('profile.action.save')}
          onPress={handleSave}
          disabled={isBusy || !isOnline}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveHeaderBtn,
            { opacity: isBusy || !isOnline ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Text style={[styles.saveHeaderText, { color: theme.colors.accent }]}>
              {t('profile.action.save')}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Offline Banner */}
        {!isOnline ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('settings.offlineNotice')}
              testID="profile-offline-banner"
            />
          </View>
        ) : null}

        {/* Success Banner */}
        {successMessage ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="success"
              message={successMessage}
              testID="profile-success-banner"
            />
          </View>
        ) : null}

        {/* Error Banner */}
        {errorMessage ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="error"
              message={errorMessage}
              testID="profile-error-banner"
            />
          </View>
        ) : null}

        {/* Avatar Initials Display */}
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: theme.colors.accentTint },
            ]}
          >
            <Text
              style={[
                styles.avatarInitials,
                { color: theme.colors.accent },
              ]}
              testID="profile-avatar-initials"
            >
              {initials}
            </Text>
          </View>
        </View>

        {/* Personal Information Fields */}
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
          {t('profile.section.personal')}
        </Text>

        <View style={styles.fieldsContainer}>
          <TextField
            label={t('profile.label.name')}
            value={nameInput}
            onChangeText={handleNameChange}
            error={nameError}
            editable={isOnline && !isBusy}
            testID="profile-name-input"
            autoCapitalize="words"
            returnKeyType="done"
          />

          <TextField
            label={t('profile.label.email')}
            value={user?.email || ''}
            editable={false}
            hint={t('profile.emailReadonly')}
            testID="profile-email-input"
          />
        </View>

        {/* Security Section */}
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
          {t('profile.security')}
        </Text>

        {securityMessage ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone={securityMessage.tone}
              message={securityMessage.text}
              testID="profile-security-banner"
            />
          </View>
        ) : null}

        <View
          style={[
            styles.listCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <Pressable
            testID="profile-change-password-button"
            accessibilityRole="button"
            accessibilityLabel={t('profile.resetPasswordAction')}
            onPress={handleResetPassword}
            disabled={isBusy || !isOnline}
            style={({ pressed }) => [
              styles.listRow,
              {
                backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
                opacity: isBusy || !isOnline ? 0.6 : 1,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.infoTint }]}>
              <Lock size={18} color={theme.colors.info} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('profile.resetPasswordAction')}
              </Text>
            </View>
            {isSendingReset ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
                <ChevronRight
                  size={18}
                  color={theme.colors.textMuted}
                />
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveHeaderBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  saveHeaderText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  bannerWrapper: {
    marginBottom: 4,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  fieldsContainer: {
    gap: 12,
  },
  listCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
  },
  rowBody: {
    flex: 1,
    marginEnd: 8,
  },
});
