import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Mail,
  User as UserIcon,
  LogOut,
  DollarSign,
  Layers,
  Sun,
  Moon,
  Globe,
  Calendar,
  FileText,
  AlertCircle,
  Check,
  Trash2,
} from 'lucide-react-native';
import { supportedCurrencies, type CurrencyCode } from '@haseela/shared';
import { useTheme, type ColorSchemePreference } from '../../theme';
import { useI18n } from '../../i18n';
import { useAuth } from '../../auth';
import { getSessionEpoch, getCurrentAuthUserId } from '../../auth/authScope';
import { usePreferences, useUpdatePreferences } from '../../api';
import { useIsOnline } from '../../query';
import {
  Button,
  Banner,
  Chevron,
  ListGroup,
  ListRow,
  ScreenContainer,
  SectionHeader,
} from '../../components/ui';
import { SegmentedSetting } from '../../components/settings/SegmentedSetting';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, preference, setPreference, isDark } = useTheme();
  const { t, locale, setLocale, isRTL } = useI18n();
  const { user, signOut, status: authStatus } = useAuth();
  const isOnline = useIsOnline();

  const {
    data: preferences,
    isLoading: isPrefsLoading,
    isError: isPrefsError,
    error: prefsError,
    refetch: refetchPrefs,
    isRefetching: isPrefsRefetching,
  } = usePreferences();

  const updatePreferencesMutation = useUpdatePreferences();

  // Local state
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
  const [draftCurrency, setDraftCurrency] = useState<CurrencyCode>('USD');
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Synchronous operation lock across conflicting server actions
  const activeOpRef = useRef<{ id: number; ownerId: string; epoch: number } | null>(null);
  const opSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Initialize draft currency when opening modal or on initial preferences load
  const activeCurrency: CurrencyCode = preferences?.currency || 'USD';

  // Reset ALL owner-bound state on actual account switch
  const prevOwnerRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevOwnerRef.current && prevOwnerRef.current !== user?.id) {
      activeOpRef.current = null;
      setIsCurrencyModalOpen(false);
      setDraftCurrency(preferences?.currency || 'USD');
      setCurrencyError(null);
      setToggleError(null);
      setIsSigningOut(false);
    }
    prevOwnerRef.current = user?.id;
  }, [user?.id, preferences?.currency]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeOpRef.current = null;
    };
  }, []);

  const isBusy =
    Boolean(activeOpRef.current) ||
    updatePreferencesMutation.isPending ||
    isSigningOut ||
    !isOnline;

  const handleOpenCurrencyModal = () => {
    setDraftCurrency(activeCurrency);
    setCurrencyError(null);
    setIsCurrencyModalOpen(true);
  };

  const handleCloseCurrencyModal = () => {
    if (isBusy) return;
    setIsCurrencyModalOpen(false);
    setCurrencyError(null);
    setDraftCurrency(activeCurrency);
  };

  const handleConfirmCurrency = async () => {
    if (activeOpRef.current !== null || !user?.id || !isOnline) return;
    if (draftCurrency === activeCurrency) {
      setIsCurrencyModalOpen(false);
      return;
    }

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
    setCurrencyError(null);

    try {
      await updatePreferencesMutation.mutateAsync({ currency: draftCurrency });
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setIsCurrencyModalOpen(false);
        activeOpRef.current = null;
      }
    } catch {
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setCurrencyError(t('settings.toast.saveFailed'));
        activeOpRef.current = null;
      }
    }
  };

  const handleToggleBillingReminders = async (nextValue: boolean) => {
    if (activeOpRef.current !== null || !user?.id || !isOnline) return;

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
    setToggleError(null);

    try {
      await updatePreferencesMutation.mutateAsync({ notifyBillingReminders: nextValue });
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        activeOpRef.current = null;
      }
    } catch {
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setToggleError(t('settings.toast.saveFailed'));
        activeOpRef.current = null;
      }
    }
  };

  const handleToggleInvoiceDue = async (nextValue: boolean) => {
    if (activeOpRef.current !== null || !user?.id || !isOnline) return;

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
    setToggleError(null);

    try {
      await updatePreferencesMutation.mutateAsync({ notifyInvoiceDue: nextValue });
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        activeOpRef.current = null;
      }
    } catch {
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setToggleError(t('settings.toast.saveFailed'));
        activeOpRef.current = null;
      }
    }
  };

  const handleSignOut = async () => {
    if (activeOpRef.current !== null || isSigningOut) return;

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user?.id || '';
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
    setIsSigningOut(true);

    try {
      await signOut();
    } finally {
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setIsSigningOut(false);
        activeOpRef.current = null;
      }
    }
  };

  // Cold loading state (auth initializing or preferences fetching with no cache)
  if ((authStatus === 'loading' || isPrefsLoading) && !preferences) {
    return (
      <ScreenContainer testID="settings-loading-screen" edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.body,
              styles.loadingText,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('onboarding.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Error state with no cache available
  if (isPrefsError && !preferences) {
    return (
      <ScreenContainer testID="settings-error-screen" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('settings.toast.saveFailed')}
          </Text>
          <Text
            style={[
              theme.typography.body,
              styles.errorBody,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetchPrefs()}
            style={styles.retryButton}
            testID="settings-retry-button"
          >
            {t('offline.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  const isServerWriteDisabled = isBusy;

  return (
    <ScreenContainer testID="settings-screen" edges={['top', 'left', 'right']} scrollable={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="settings-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.currency.back')}
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
        >
          <ArrowLeft
            size={22}
            color={theme.colors.text}
            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}
        >
          {t('settings.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline notice banner */}
        {!isOnline ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('settings.offlineNotice')}
              testID="settings-offline-banner"
            />
          </View>
        ) : null}

        {/* Stale refetch error banner */}
        {isPrefsError && preferences ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('offline.body')}
              testID="settings-stale-banner"
            />
          </View>
        ) : null}

        {/* Toggle mutation error banner */}
        {toggleError ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="error"
              message={toggleError}
              testID="settings-toggle-error-banner"
            />
          </View>
        ) : null}

        {/* 1. Account */}
        <View>
          <SectionHeader variant="label" title={t('settings.section.account')} />
          <ListGroup>
            <ListRow
              icon={Mail}
              iconTone="info"
              title={t('profile.label.email')}
              trailing={
                <Text
                  style={[theme.typography.body, styles.emailValue, { color: theme.colors.textSecondary }]}
                  testID="settings-user-email"
                  numberOfLines={1}
                >
                  {user?.email || '—'}
                </Text>
              }
            />
            <ListRow
              testID="settings-profile-link"
              icon={UserIcon}
              iconTone="accent"
              title={t('settings.action.profile')}
              onPress={() => router.push('/(app)/profile' as any)}
            />
            <ListRow
              testID="settings-logout-button"
              icon={LogOut}
              danger
              title={t('settings.action.logout')}
              disabled={isBusy}
              onPress={handleSignOut}
              trailing={
                isSigningOut ? (
                  <ActivityIndicator size="small" color={theme.colors.negativeText} />
                ) : undefined
              }
            />
          </ListGroup>
        </View>

        {/* 2. Workspace */}
        <View>
          <SectionHeader variant="label" title={t('settings.section.workspace')} />
          <ListGroup>
            <ListRow
              testID="settings-currency-row"
              icon={DollarSign}
              iconTone="positive"
              title={t('settings.label.currency')}
              onPress={handleOpenCurrencyModal}
              trailing={
                <View style={styles.valueWithChevron}>
                  <Text
                    style={[theme.typography.bodySemiBold, { color: theme.colors.textSecondary }]}
                    testID="settings-currency-display"
                  >
                    {activeCurrency}
                  </Text>
                  <Chevron size={18} color={theme.colors.textMuted} />
                </View>
              }
            />
            <ListRow
              icon={Layers}
              iconTone="accent"
              title={t('settings.label.accountingMode')}
              trailing={
                <Text
                  style={[theme.typography.body, { color: theme.colors.textMuted }]}
                  testID="settings-accounting-mode"
                >
                  {t('settings.option.cashBasis')}
                </Text>
              }
            />
          </ListGroup>
        </View>

        {/* 3. Appearance: theme + language */}
        <View>
          <SectionHeader variant="label" title={t('settings.section.appearance')} />
          <ListGroup>
            <SegmentedSetting
              icon={isDark ? Moon : Sun}
              iconTone={isDark ? 'accent' : 'warning'}
              title={t('settings.section.appearance')}
              value={preference}
              onChange={setPreference}
              options={[
                { value: 'system', label: t('settings.theme.system'), testID: 'theme-seg-system' },
                { value: 'light', label: t('settings.theme.light'), testID: 'theme-seg-light' },
                { value: 'dark', label: t('settings.theme.dark'), testID: 'theme-seg-dark' },
              ]}
            />
            <SegmentedSetting
              icon={Globe}
              iconTone="accent"
              title={t('settings.label.language')}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'ar', label: 'العربية', testID: 'lang-seg-ar' },
                { value: 'en', label: 'English', testID: 'lang-seg-en' },
              ]}
            />
          </ListGroup>
        </View>

        {/* 4. Notifications */}
        <View>
          <SectionHeader variant="label" title={t('settings.section.notifications')} />
          <ListGroup>
            <ListRow
              icon={Calendar}
              iconTone="warning"
              title={t('settings.label.billingReminders')}
              subtitle={t('settings.hint.billingReminders')}
              trailing={
                <Switch
                  testID="toggle-billing-reminders"
                  accessibilityLabel={t('settings.label.billingReminders')}
                  value={preferences?.notifyBillingReminders ?? true}
                  onValueChange={handleToggleBillingReminders}
                  disabled={isServerWriteDisabled}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <ListRow
              icon={FileText}
              iconTone="info"
              title={t('settings.label.invoiceAlerts')}
              subtitle={t('settings.hint.invoiceAlerts')}
              trailing={
                <Switch
                  testID="toggle-invoice-alerts"
                  accessibilityLabel={t('settings.label.invoiceAlerts')}
                  value={preferences?.notifyInvoiceDue ?? true}
                  onValueChange={handleToggleInvoiceDue}
                  disabled={isServerWriteDisabled}
                  trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          </ListGroup>
        </View>

        {/* 5. Danger zone */}
        <View>
          <SectionHeader
            variant="label"
            testID="settings-danger-header"
            color={theme.colors.negativeText}
            title={t('settings.section.danger')}
          />
          <ListGroup style={{ borderColor: `${theme.colors.negative}47` }}>
            <ListRow
              testID="settings-delete-account-link"
              icon={Trash2}
              danger
              title={t('profile.action.deleteAccount')}
              subtitle={t('profile.section.deleteSub')}
              disabled={isSigningOut}
              onPress={() => router.push('/(app)/delete-account' as never)}
            />
          </ListGroup>
        </View>
      </ScrollView>

      {/* Currency Selection Accessible Modal */}
      <Modal
        visible={isCurrencyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCurrencyModal}
        testID="settings-currency-modal"
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={[theme.typography.h3, styles.modalTitle, { color: theme.colors.text }]}
            >
              {t('settings.currencyModalTitle')}
            </Text>

            {currencyError ? (
              <View style={styles.modalBanner}>
                <Banner
                  tone="error"
                  message={currencyError}
                  testID="settings-currency-error-banner"
                />
              </View>
            ) : null}

            {!isOnline ? (
              <View style={styles.modalBanner}>
                <Banner
                  tone="warning"
                  message={t('settings.offlineNotice')}
                  testID="settings-currency-offline-banner"
                />
              </View>
            ) : null}

            <View style={styles.currencyList}>
              {supportedCurrencies.map((c) => {
                const isSelected = draftCurrency === c.code;

                return (
                  <Pressable
                    key={c.code}
                    testID={`currency-option-${c.code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    disabled={isBusy}
                    onPress={() => setDraftCurrency(c.code)}
                    style={({ pressed }) => [
                      styles.currencyOption,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accentTint
                          : pressed
                          ? theme.colors.surfaceHover
                          : 'transparent',
                        borderColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.border,
                        borderRadius: theme.radius.md,
                      },
                    ]}
                  >
                    <View style={styles.currencyInfo}>
                      <Text
                        style={[
                          theme.typography.bodySemiBold,
                          { color: isSelected ? theme.colors.accent : theme.colors.text },
                        ]}
                      >
                        {c.code}
                      </Text>
                      <Text
                        style={[
                          theme.typography.caption,
                          { color: theme.colors.textSecondary, marginStart: 8 },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Check size={18} color={theme.colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Button
                variant="secondary"
                onPress={handleCloseCurrencyModal}
                disabled={isBusy}
                testID="settings-currency-cancel-button"
                style={styles.modalBtn}
              >
                {t('settings.currencyCancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirmCurrency}
                loading={updatePreferencesMutation.isPending}
                disabled={isBusy}
                testID="settings-currency-confirm-button"
                style={styles.modalBtn}
              >
                {t('settings.currencyConfirm')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 20,
  },
  bannerWrapper: {
    marginBottom: 4,
  },
  emailValue: {
    flexShrink: 1,
    maxWidth: '60%',
  },
  valueWithChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 8,
    minWidth: 140,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBanner: {
    width: '100%',
  },
  currencyList: {
    gap: 8,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    minHeight: 48,
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
  },
});
