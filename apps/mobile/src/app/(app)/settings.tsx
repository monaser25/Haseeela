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
  I18nManager,
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
  ChevronRight,
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
import { Button, Banner, ScreenContainer } from '../../components/ui';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, preference, setPreference, isDark } = useTheme();
  const { t, locale, setLocale } = useI18n();
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
    <ScreenContainer testID="settings-screen" edges={['top', 'left', 'right']}>
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
            style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
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

        {/* 1. Account Section */}
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
          {t('settings.section.account')}
        </Text>
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
          {/* Email row (Read-only) */}
          <View style={[styles.listRow, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.infoTint }]}>
              <Mail size={18} color={theme.colors.info} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('profile.label.email')}
              </Text>
            </View>
            <Text
              style={[theme.typography.body, { color: theme.colors.textSecondary }]}
              testID="settings-user-email"
              numberOfLines={1}
            >
              {user?.email || '—'}
            </Text>
          </View>

          {/* Profile row */}
          <Pressable
            testID="settings-profile-link"
            accessibilityRole="button"
            accessibilityLabel={t('settings.action.profile')}
            onPress={() => router.push('/(app)/profile' as any)}
            style={({ pressed }) => [
              styles.listRow,
              {
                borderBottomColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentTint }]}>
              <UserIcon size={18} color={theme.colors.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.action.profile')}
              </Text>
            </View>
            <ChevronRight
              size={18}
              color={theme.colors.textMuted}
              style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>

          {/* Log out row */}
          <Pressable
            testID="settings-logout-button"
            accessibilityRole="button"
            accessibilityLabel={t('settings.action.logout')}
            onPress={handleSignOut}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.listRow,
              {
                borderBottomWidth: 0,
                backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
                opacity: isBusy ? 0.6 : 1,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.negativeTint }]}>
              <LogOut size={18} color={theme.colors.negative} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.negative }]}>
                {t('settings.action.logout')}
              </Text>
            </View>
            {isSigningOut ? (
              <ActivityIndicator size="small" color={theme.colors.negative} />
            ) : null}
          </Pressable>
        </View>

        {/* 2. Workspace Section */}
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
          {t('settings.section.workspace')}
        </Text>
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
          {/* Currency row */}
          <Pressable
            testID="settings-currency-row"
            accessibilityRole="button"
            accessibilityLabel={t('settings.label.currency')}
            onPress={handleOpenCurrencyModal}
            style={({ pressed }) => [
              styles.listRow,
              {
                borderBottomColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.positiveTint }]}>
              <DollarSign size={18} color={theme.colors.positive} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.label.currency')}
              </Text>
            </View>
            <Text
              style={[
                theme.typography.bodySemiBold,
                { color: theme.colors.textSecondary, marginEnd: 6 },
              ]}
              testID="settings-currency-display"
            >
              {activeCurrency}
            </Text>
            <ChevronRight
              size={18}
              color={theme.colors.textMuted}
              style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>

          {/* Accounting mode row (read-only cash basis) */}
          <View style={[styles.listRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentTint }]}>
              <Layers size={18} color={theme.colors.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.label.accountingMode')}
              </Text>
            </View>
            <Text
              style={[theme.typography.body, { color: theme.colors.textMuted }]}
              testID="settings-accounting-mode"
            >
              {t('settings.option.cashBasis')}
            </Text>
          </View>
        </View>

        {/* 3. Appearance Section */}
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
          {t('settings.section.appearance')}
        </Text>
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
          {/* Theme row */}
          <View style={[styles.listRow, { borderBottomColor: theme.colors.border }]}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isDark
                    ? theme.colors.accentTint
                    : theme.colors.warningTint,
                },
              ]}
            >
              {isDark ? (
                <Moon size={18} color={theme.colors.accent} />
              ) : (
                <Sun size={18} color={theme.colors.warning} />
              )}
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.section.appearance')}
              </Text>
            </View>
          </View>

          {/* Theme segmented control */}
          <View style={styles.segmentedContainer}>
            <View
              style={[
                styles.segmentedTrack,
                {
                  backgroundColor: theme.colors.surfaceHover,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {(['system', 'light', 'dark'] as ColorSchemePreference[]).map((mode) => {
                const isSelected = preference === mode;
                const label =
                  mode === 'system'
                    ? t('settings.theme.system')
                    : mode === 'light'
                    ? t('settings.theme.light')
                    : t('settings.theme.dark');

                return (
                  <Pressable
                    key={mode}
                    testID={`theme-seg-${mode}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setPreference(mode)}
                    style={[
                      styles.segmentedItem,
                      isSelected && {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        styles.segmentedText,
                        {
                          color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                          fontWeight: isSelected ? '600' : '500',
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Language row */}
          <View style={[styles.listRow, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentTint }]}>
              <Globe size={18} color={theme.colors.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.label.language')}
              </Text>
            </View>
          </View>

          {/* Language segmented control */}
          <View style={styles.segmentedContainer}>
            <View
              style={[
                styles.segmentedTrack,
                {
                  backgroundColor: theme.colors.surfaceHover,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {[
                { code: 'ar' as const, label: 'العربية' },
                { code: 'en' as const, label: 'English' },
              ].map((lang) => {
                const isSelected = locale === lang.code;

                return (
                  <Pressable
                    key={lang.code}
                    testID={`lang-seg-${lang.code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setLocale(lang.code)}
                    style={[
                      styles.segmentedItem,
                      isSelected && {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        styles.segmentedText,
                        {
                          color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                          fontWeight: isSelected ? '600' : '500',
                        },
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* 4. Notifications Section */}
        <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
          {t('settings.section.notifications')}
        </Text>
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
          {/* Billing reminders */}
          <View style={[styles.listRow, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.warningTint }]}>
              <Calendar size={18} color={theme.colors.warning} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.label.billingReminders')}
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary, marginTop: 2 },
                ]}
              >
                {t('settings.hint.billingReminders')}
              </Text>
            </View>
            <Switch
              testID="toggle-billing-reminders"
              accessibilityLabel={t('settings.label.billingReminders')}
              value={preferences?.notifyBillingReminders ?? true}
              onValueChange={handleToggleBillingReminders}
              disabled={isServerWriteDisabled}
              trackColor={{
                false: theme.colors.surfaceHover,
                true: theme.colors.accent,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Invoice due alerts */}
          <View style={[styles.listRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.infoTint }]}>
              <FileText size={18} color={theme.colors.info} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                {t('settings.label.invoiceAlerts')}
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary, marginTop: 2 },
                ]}
              >
                {t('settings.hint.invoiceAlerts')}
              </Text>
            </View>
            <Switch
              testID="toggle-invoice-alerts"
              accessibilityLabel={t('settings.label.invoiceAlerts')}
              value={preferences?.notifyInvoiceDue ?? true}
              onValueChange={handleToggleInvoiceDue}
              disabled={isServerWriteDisabled}
              trackColor={{
                false: theme.colors.surfaceHover,
                true: theme.colors.accent,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* 5. Danger zone */}
        <Text
          testID="settings-danger-header"
          style={[styles.sectionHeader, { color: theme.colors.negativeText }]}
        >
          {t('settings.section.danger')}
        </Text>
        <View
          style={[
            styles.listCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.negative,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <Pressable
            testID="settings-delete-account-link"
            accessibilityRole="button"
            accessibilityLabel={t('profile.action.deleteAccount')}
            onPress={() => router.push('/(app)/delete-account' as never)}
            disabled={isSigningOut}
            style={({ pressed }) => [
              styles.listRow,
              {
                borderBottomWidth: 0,
                backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
                opacity: isSigningOut ? 0.6 : 1,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.negativeTint }]}>
              <Trash2 size={18} color={theme.colors.negativeText} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[theme.typography.bodySemiBold, { color: theme.colors.negativeText }]}>
                {t('profile.action.deleteAccount')}
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary, marginTop: 2 },
                ]}
              >
                {t('profile.section.deleteSub')}
              </Text>
            </View>
            <ChevronRight
              size={18}
              color={theme.colors.textMuted}
              style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>
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
    gap: 12,
  },
  bannerWrapper: {
    marginBottom: 4,
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
  listCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
    borderBottomWidth: 1,
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
  segmentedContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    minHeight: 36,
  },
  segmentedText: {
    fontSize: 13,
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
