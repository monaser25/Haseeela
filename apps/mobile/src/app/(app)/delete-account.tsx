import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useAuth } from '../../auth';
import { getSessionEpoch, getCurrentAuthUserId } from '../../auth/authScope';
import { setAccountDeletionNotice } from '../../auth/accountDeletionNotice';
import { requestAccountDeletion } from '../../api/accountApi';
import { useIsOnline } from '../../query';
import { Button, Banner, TextField, ScreenContainer } from '../../components/ui';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, isRTL } = useI18n();
  const { user, signOut } = useAuth();
  const isOnline = useIsOnline();

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronous single-flight lock plus identity fences (same pattern as profile / settings)
  const activeOpRef = useRef<{ id: number; ownerId: string; epoch: number } | null>(null);
  const opSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Always call the latest sign-out: it is bound to the current session's access token.
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  // Reset everything owner-bound when the account changes underneath this screen
  const prevOwnerRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevOwnerRef.current && prevOwnerRef.current !== user?.id) {
      activeOpRef.current = null;
      setIsDeleting(false);
      setErrorMessage(null);
      setConfirmText('');
    }
    prevOwnerRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const confirmWord = t('settings.delete.confirmWord');
  const isConfirmed = confirmText.trim().toLocaleLowerCase() === confirmWord.toLocaleLowerCase();
  const canDelete = isConfirmed && isOnline && !isDeleting && Boolean(user?.id);

  const handleDelete = async () => {
    if (activeOpRef.current !== null || !canDelete || !user?.id) return;

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
    setIsDeleting(true);
    setErrorMessage(null);

    // Same account and session as when the request started. Deliberately independent of whether
    // this screen is still mounted: once the server has (or may have) deleted the account, the
    // local session must end even if the user navigated away while waiting.
    const sameSession = () =>
      getSessionEpoch() === initiatingEpoch && getCurrentAuthUserId() === initiatingOwnerId;
    const ownsScreenState = () => isMountedRef.current && activeOpRef.current?.id === opId;

    const result = await requestAccountDeletion({
      expectedOwnerId: initiatingOwnerId,
      expectedEpoch: initiatingEpoch,
    });

    if (!sameSession()) {
      // A different account (or no account) is current now: apply nothing to it.
      return;
    }

    if (result.status === 'failed') {
      if (ownsScreenState()) {
        setErrorMessage(t('settings.delete.error.failed'));
        setIsDeleting(false);
        activeOpRef.current = null;
      }
      return;
    }

    // Deleted, or deletion in progress / outcome unknown after the request was sent. Either way the
    // account must not be presented as active: leave through the regular sign-out path, which
    // queues behind other auth work, unregisters push for this owner, and clears the owner's
    // query and persisted caches.
    setAccountDeletionNotice(result.status === 'deleted' ? 'deleted' : 'pending');
    try {
      await signOutRef.current();
    } catch {
      // Local state is already signed out; nothing further to report.
    }
  };

  return (
    <ScreenContainer testID="delete-account-screen" edges={['top', 'left', 'right']} scrollable={false} padded={false}>
      <View style={styles.header}>
        <Pressable
          testID="delete-account-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.currency.back')}
          onPress={() => router.back()}
          disabled={isDeleting}
          hitSlop={8}
          style={[styles.backBtn, { opacity: isDeleting ? 0.4 : 1 }]}
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
          {t('settings.delete.screenTitle')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!isOnline ? (
          <Banner
            tone="warning"
            message={t('settings.delete.offline')}
            testID="delete-account-offline-banner"
          />
        ) : null}

        {errorMessage ? (
          <Banner tone="error" message={errorMessage} testID="delete-account-error-banner" />
        ) : null}

        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: theme.colors.negativeTint,
              borderColor: theme.colors.negative,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <AlertTriangle size={24} color={theme.colors.negativeText} />
          <Text
            testID="delete-account-warning-title"
            style={[theme.typography.h3, { color: theme.colors.negativeText }]}
          >
            {t('settings.delete.warningTitle')}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text }]}>
            {t('profile.modal.deleteBody')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {t('settings.delete.processNote')}
          </Text>
        </View>

        <TextField
          label={t('settings.delete.confirmLabel', { word: confirmWord })}
          placeholder={t('settings.delete.confirmPlaceholder')}
          value={confirmText}
          onChangeText={setConfirmText}
          editable={!isDeleting}
          autoCapitalize="none"
          autoCorrect={false}
          testID="delete-account-confirm-input"
        />

        <Button
          variant="destructive"
          onPress={handleDelete}
          disabled={!canDelete}
          loading={isDeleting}
          testID="delete-account-confirm-button"
        >
          {isDeleting ? t('settings.delete.action.deleting') : t('profile.action.deleteEverything')}
        </Button>
        <Button
          variant="secondary"
          onPress={() => router.back()}
          disabled={isDeleting}
          testID="delete-account-cancel-button"
        >
          {t('profile.action.cancel')}
        </Button>
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
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  warningCard: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
  },
});
