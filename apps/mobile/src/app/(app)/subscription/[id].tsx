import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { Subscription } from '@haseela/shared';
import { computeNextBillingDate } from '@haseela/shared';
import { ArrowLeft, Edit2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import {
  useOverview,
  usePreferences,
  useUpdateSubscription,
  useArchiveSubscription,
  useRestoreSubscription,
  useDeleteSubscriptionPermanent,
  useRecordSubscriptionPayment,
} from '../../../api';
import { useIsOnline } from '../../../query';
import { onlineManager } from '@tanstack/react-query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import { parseCalendarDate } from '../../../utils/calendarDate';
import {
  SubscriptionDetailOverview,
  SubscriptionDetailActions,
  SubscriptionTransactionHistory,
  SubscriptionFormFields,
  ArchiveSubscriptionModal,
  PermanentDeleteSubscriptionModal,
  RecordSubscriptionPaymentModal,
  validateSubscriptionFormInput,
  parseLocalizedBillingDay,
} from '../../../components/subscriptions';

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const {
    data: overview,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useOverview();

  const subscription = useMemo(
    () => overview?.subscriptions.find((item) => item.id === id) ?? null,
    [overview, id]
  );

  // If subscription is found in cache/query, render keyed detail viewer
  if (subscription) {
    return (
      <SubscriptionDetailViewer
        key={subscription.id}
        subscription={subscription}
        isStale={Boolean(isError)}
      />
    );
  }

  // From here down, subscription is null.
  // 1. Cold offline with empty cache
  if (!isOnline && !overview) {
    return (
      <ScreenContainer
        testID="subscription-detail-offline"
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.retryBtn}
          >
            {t('offline.action.retry')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            {t('subscriptions.backToSubscriptions')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // 2. Loading state: overview is loading or refetching in background
  if (isLoading || isFetching || (!overview && !isError && isOnline)) {
    return (
      <ScreenContainer
        testID="subscription-detail-loading"
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.body,
              styles.loadingText,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('subscriptions.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // 3. Network error state when query fails and no cached subscription exists
  if (isError) {
    return (
      <ScreenContainer
        testID="subscription-detail-error"
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('subscriptions.error.generic')}
          </Text>
          <Text
            style={[
              theme.typography.body,
              styles.errorBody,
              { color: theme.colors.textSecondary },
            ]}
          >
            {error instanceof Error ? error.message : t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.retryBtn}
          >
            {t('offline.action.retry')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            {t('subscriptions.backToSubscriptions')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // 4. Offline when subscription is missing from cached overview
  if (!isOnline) {
    return (
      <ScreenContainer
        testID="subscription-detail-offline"
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('offline.body')}
          </Text>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            {t('subscriptions.backToSubscriptions')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // 5. Genuine missing subscription (online, query settled, overview loaded, not in list)
  return (
    <ScreenContainer
      testID="subscription-not-found"
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View style={styles.notFoundContainer}>
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>
          {t('subscriptions.notFound')}
        </Text>
        <Button
          variant="secondary"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          {t('subscriptions.backToSubscriptions')}
        </Button>
      </View>
    </ScreenContainer>
  );
}

interface SubscriptionDetailViewerProps {
  subscription: Subscription;
  isStale?: boolean;
}

function SubscriptionDetailViewer({
  subscription,
  isStale = false,
}: SubscriptionDetailViewerProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const { data: overview } = useOverview();
  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';

  // Mutations
  const updateMutation = useUpdateSubscription();
  const archiveMutation = useArchiveSubscription();
  const restoreMutation = useRestoreSubscription();
  const deletePermanentMutation = useDeleteSubscriptionPermanent();
  const recordPaymentMutation = useRecordSubscriptionPayment();

  const isAnyPending =
    updateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deletePermanentMutation.isPending ||
    recordPaymentMutation.isPending;

  // Edit mode state & session key (incremented on each new edit session to remount form fresh from latest subscription)
  const [isEditing, setIsEditing] = useState(false);
  const [editSessionKey, setEditSessionKey] = useState(0);

  // Global feedback & general error
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modals state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeletePermanentModal, setShowDeletePermanentModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  // Linked transactions from authoritative overview
  const linkedTransactions = useMemo(() => {
    const list = overview?.transactions ?? [];
    return list.filter(
      (tx) =>
        tx.subscriptionId === subscription.id ||
        (tx.sourceType === 'subscription' && tx.sourceId === subscription.id)
    );
  }, [overview, subscription.id]);

  const handleStartEdit = () => {
    if (isAnyPending) return;
    setGeneralError(null);
    setFeedbackSuccess(null);
    setEditSessionKey((prev) => prev + 1);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isAnyPending) return;
    setGeneralError(null);
    setFeedbackSuccess(null);
    setIsEditing(false);
  };

  const handleArchiveConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || archiveMutation.isPending) return;
    try {
      await archiveMutation.mutateAsync(subscription.id);
      setShowArchiveModal(false);
      router.back();
    } catch {
      // Error displayed in modal
    }
  };

  const handleRestoreConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || restoreMutation.isPending) return;
    try {
      await restoreMutation.mutateAsync(subscription.id);
      setFeedbackSuccess(t('subscriptions.feedback.restored'));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('subscriptions.error.generic'));
    }
  };

  const handleDeletePermanentConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || deletePermanentMutation.isPending) return;
    if (!subscription.archivedAt) return;
    try {
      await deletePermanentMutation.mutateAsync(subscription.id);
      setShowDeletePermanentModal(false);
      router.back();
    } catch {
      // Error displayed in modal
    }
  };

  const handleRecordPaymentConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || recordPaymentMutation.isPending) return;
    try {
      await recordPaymentMutation.mutateAsync({ id: subscription.id });
      setShowRecordPaymentModal(false);
      setFeedbackSuccess(t('subscriptions.feedback.paymentRecorded'));
    } catch {
      // Error displayed in modal
    }
  };

  const isArchived = Boolean(subscription.archivedAt);

  return (
    <ScreenContainer
      testID="subscription-detail-screen"
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable
            testID="subscription-detail-back"
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.currency.back')}
            disabled={isAnyPending}
            onPress={() => router.back()}
            hitSlop={8}
            style={[styles.backBtn, { opacity: isAnyPending ? 0.5 : 1 }]}
          >
            <ArrowLeft size={22} color={theme.colors.text} />
          </Pressable>

          <Text
            accessibilityRole="header"
            style={[theme.typography.h3, styles.headerTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {isEditing ? t('subscriptions.form.editTitle') : subscription.name}
          </Text>

          {!isArchived && (
            <Pressable
              testID={isEditing ? 'subscription-cancel-edit-button' : 'subscription-edit-button'}
              accessibilityRole="button"
              accessibilityLabel={
                isEditing
                  ? t('subscriptions.form.cancel')
                  : t('subscriptions.detail.edit')
              }
              disabled={isAnyPending}
              onPress={isEditing ? handleCancelEdit : handleStartEdit}
              hitSlop={8}
              style={[
                styles.editBtn,
                {
                  backgroundColor: theme.colors.surfaceHover,
                  opacity: isAnyPending ? 0.5 : 1,
                },
              ]}
            >
              {isEditing ? (
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('subscriptions.form.cancel')}
                </Text>
              ) : (
                <Edit2 size={18} color={theme.colors.text} />
              )}
            </Pressable>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Offline Banner */}
          {!isOnline && (
            <Banner
              tone="warning"
              message={t('subscriptions.offline.banner')}
            />
          )}

          {/* Stale Cached Data Feedback */}
          {isStale && (
            <Banner
              tone="warning"
              message={t('errors.cachedData')}
            />
          )}

          {/* Feedback & Error Banners */}
          {Boolean(feedbackSuccess) && (
            <Banner tone="notice" message={feedbackSuccess ?? undefined} />
          )}

          {Boolean(generalError) && (
            <Banner tone="error" message={generalError ?? undefined} />
          )}

          {isEditing ? (
            /* Form editor mounted fresh per edit entry, preserving dirty state across background refetches */
            <SubscriptionFormEditor
              key={editSessionKey}
              subscription={subscription}
              currency={currency}
              isPending={updateMutation.isPending}
              onSave={async (payload) => {
                await updateMutation.mutateAsync({
                  id: subscription.id,
                  updates: payload,
                });
                setIsEditing(false);
                setFeedbackSuccess(t('subscriptions.feedback.saved'));
              }}
              onCancel={handleCancelEdit}
            />
          ) : (
            /* Read-Only Detail View */
            <View>
              <SubscriptionDetailOverview
                subscription={subscription}
                currency={currency}
              />

              <SubscriptionDetailActions
                subscription={subscription}
                isOnline={isOnline}
                isRestoring={restoreMutation.isPending}
                isBusy={isAnyPending}
                onRecordPayment={() => {
                  setGeneralError(null);
                  setFeedbackSuccess(null);
                  recordPaymentMutation.reset();
                  setShowRecordPaymentModal(true);
                }}
                onArchive={() => {
                  setGeneralError(null);
                  setFeedbackSuccess(null);
                  archiveMutation.reset();
                  setShowArchiveModal(true);
                }}
                onRestore={handleRestoreConfirm}
                onDeletePermanent={() => {
                  setGeneralError(null);
                  setFeedbackSuccess(null);
                  deletePermanentMutation.reset();
                  setShowDeletePermanentModal(true);
                }}
              />

              <SubscriptionTransactionHistory
                subscriptionId={subscription.id}
                transactions={overview?.transactions ?? []}
                currency={currency}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Archive Modal */}
      <ArchiveSubscriptionModal
        visible={showArchiveModal}
        subscription={subscription}
        transactionCount={linkedTransactions.length}
        currency={currency}
        isArchiving={archiveMutation.isPending}
        isOnline={isOnline}
        error={archiveMutation.error ? archiveMutation.error.message : null}
        onConfirm={handleArchiveConfirm}
        onCancel={() => {
          archiveMutation.reset();
          setShowArchiveModal(false);
        }}
        testID="archive-subscription-modal"
      />

      {/* Permanent Delete Modal */}
      <PermanentDeleteSubscriptionModal
        visible={showDeletePermanentModal}
        subscription={subscription}
        isDeleting={deletePermanentMutation.isPending}
        isOnline={isOnline}
        error={
          deletePermanentMutation.error
            ? deletePermanentMutation.error.message
            : null
        }
        onConfirm={handleDeletePermanentConfirm}
        onCancel={() => {
          deletePermanentMutation.reset();
          setShowDeletePermanentModal(false);
        }}
        testID="permanent-delete-subscription-modal"
      />

      {/* Record Payment Modal */}
      <RecordSubscriptionPaymentModal
        visible={showRecordPaymentModal}
        subscription={subscription}
        currency={currency}
        isRecording={recordPaymentMutation.isPending}
        isOnline={isOnline}
        error={
          recordPaymentMutation.error
            ? recordPaymentMutation.error.message
            : null
        }
        onConfirm={handleRecordPaymentConfirm}
        onCancel={() => {
          recordPaymentMutation.reset();
          setShowRecordPaymentModal(false);
        }}
        testID="record-subscription-payment-modal"
      />
    </ScreenContainer>
  );
}

interface SubscriptionFormEditorProps {
  subscription: Subscription;
  currency: string;
  isPending: boolean;
  onSave: (payload: any) => Promise<void>;
  onCancel: () => void;
}

function SubscriptionFormEditor({
  subscription,
  currency,
  isPending,
  onSave,
}: SubscriptionFormEditorProps) {
  const { t } = useI18n();
  const isOnline = useIsOnline();

  // Form state initialized from the latest subscription passed on mount
  const [name, setName] = useState(subscription.name);
  const [amountStr, setAmountStr] = useState(String(subscription.amount));
  const [cycle, setCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>(
    subscription.billingCycle || subscription.cycle || 'MONTHLY'
  );
  const initialBillingDay =
    subscription.billingDay || Math.max(1, Math.min(28, new Date().getDate()));
  const [billingDayStr, setBillingDayStr] = useState(String(initialBillingDay));
  const [nextBillingDate, setNextBillingDate] = useState<Date>(() =>
    subscription.nextBillingDate
      ? parseCalendarDate(subscription.nextBillingDate)
      : parseCalendarDate(computeNextBillingDate(initialBillingDay))
  );
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(subscription.status);
  const [notes, setNotes] = useState(subscription.notes ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleBillingDayChange = (text: string) => {
    setBillingDayStr(text);
    const parsed = parseLocalizedBillingDay(text);
    if (parsed.value != null) {
      setNextBillingDate(parseCalendarDate(computeNextBillingDate(parsed.value)));
    }
  };

  const handleSave = async () => {
    if (!isOnline || !onlineManager.isOnline() || isPending) return;

    setFieldErrors({});
    setFormError(null);

    const validation = validateSubscriptionFormInput(
      {
        name,
        amountStr,
        cycle,
        billingDayStr,
        nextBillingDate,
        status,
        notes,
      },
      t as any,
      true,
      subscription.notes
    );

    if (!validation.valid || !validation.payload) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      await onSave(validation.payload);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('subscriptions.error.generic'));
    }
  };

  return (
    <View style={styles.formContainer}>
      {Boolean(formError) && (
        <Banner tone="error" message={formError ?? undefined} />
      )}

      <SubscriptionFormFields
        testIDPrefix="subscription-edit"
        name={name}
        onChangeName={setName}
        amountStr={amountStr}
        onChangeAmountStr={setAmountStr}
        cycle={cycle}
        onChangeCycle={setCycle}
        billingDayStr={billingDayStr}
        onChangeBillingDayStr={handleBillingDayChange}
        nextBillingDate={nextBillingDate}
        onChangeNextBillingDate={setNextBillingDate}
        status={status}
        onChangeStatus={setStatus}
        notes={notes}
        onChangeNotes={setNotes}
        currency={currency}
        fieldErrors={fieldErrors}
        disabled={isPending}
        isEdit={true}
      />

      <Button
        variant="primary"
        onPress={handleSave}
        loading={isPending}
        disabled={!isOnline || isPending}
        style={styles.saveBtn}
        testID="subscription-save-button"
      >
        {isPending ? t('subscriptions.form.saving') : t('subscriptions.form.save')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 4,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
  },
  editBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  formContainer: {
    gap: 14,
  },
  saveBtn: {
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    minWidth: 140,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  backButton: {
    minWidth: 160,
  },
});
