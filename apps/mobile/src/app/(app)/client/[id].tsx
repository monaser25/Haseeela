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
import type { Client } from '@haseela/shared';
import { ClientSchema, computeNextBillingDate, getClientRevenue } from '@haseela/shared';
import { ArrowLeft, Edit2, Check, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import {
  useOverview,
  usePreferences,
  useUpdateClient,
  useArchiveClient,
  useRestoreClient,
  useDeleteClientPermanent,
  useRecordClientPayment,
  useCreatePendingPayment,
  useClientTransactionCount,
} from '../../../api';
import { useIsOnline } from '../../../query';
import { onlineManager } from '@tanstack/react-query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import { formatCalendarDate, parseCalendarDate } from '../../../utils/calendarDate';
import {
  ClientDetailOverview,
  ClientDetailActions,
  ClientTransactionHistory,
  ClientFormFields,
  ArchiveClientModal,
  PermanentDeleteModal,
  RecordPaymentModal,
  AddPendingPaymentModal,
  validateClientFormInput,
  parseLocalizedBillingDay,
} from '../../../components/clients';

export default function ClientDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const { theme } = useTheme();
  const { t } = useI18n();

  const { data: overview, isLoading, isError, error, refetch } = useOverview();

  const client = useMemo(
    () => overview?.clients.find((item) => item.id === id) ?? null,
    [overview, id]
  );

  // Loading state when overview has not yet resolved and no cached client
  if (isLoading && !client) {
    return (
      <ScreenContainer testID="client-detail-loading" edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[theme.typography.body, styles.loadingText, { color: theme.colors.textMuted }]}>
            {t('clients.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Network error state when query fails and no cached client exists
  if (isError && !client) {
    return (
      <ScreenContainer testID="client-detail-error" edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text style={[theme.typography.h2, styles.errorTitle, { color: theme.colors.text }]}>
            {t('clients.error.generic')}
          </Text>
          <Text style={[theme.typography.body, styles.errorBody, { color: theme.colors.textSecondary }]}>
            {error instanceof Error ? error.message : t('offline.body')}
          </Text>
          <Button variant="primary" onPress={() => refetch()} style={styles.retryBtn}>
            {t('offline.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // Genuine missing client
  if (!isLoading && !isError && !client) {
    return (
      <ScreenContainer testID="client-not-found" edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.notFoundContainer}>
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>
            {t('clients.empty.title')}
          </Text>
          <Button variant="secondary" onPress={() => router.back()} style={styles.backBtn}>
            {t('clients.form.cancel')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // Keyed loaded editor preserves unsaved form state across background refetches
  return <ClientEditor key={client!.id} client={client!} />;
}

interface ClientEditorProps {
  client: Client;
}

function ClientEditor({ client }: ClientEditorProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const { data: overview } = useOverview();
  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';

  // Mutations
  const updateMutation = useUpdateClient();
  const archiveMutation = useArchiveClient();
  const restoreMutation = useRestoreClient();
  const deletePermanentMutation = useDeleteClientPermanent();
  const recordPaymentMutation = useRecordClientPayment();
  const addPendingMutation = useCreatePendingPayment();

  // Mode: view or edit
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [name, setName] = useState(client.name);
  const [revenueStr, setRevenueStr] = useState(String(client.revenue || 0));
  const [company, setCompany] = useState(client.company ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [clientType, setClientType] = useState(client.clientType || 'COMPANY');
  const [status, setStatus] = useState(client.status || 'ACTIVE');
  const [paymentType, setPaymentType] = useState(client.paymentType || 'onetime');
  const [paymentDate, setPaymentDate] = useState<Date>(() =>
    client.paymentDate ? parseCalendarDate(client.paymentDate) : new Date()
  );

  const initialBillingDay = client.billingDay || Math.max(1, Math.min(28, new Date().getDate()));
  const [billingDayStr, setBillingDayStr] = useState(String(initialBillingDay));
  const [nextBillingDate, setNextBillingDate] = useState<Date>(() =>
    client.nextBillingDate
      ? parseCalendarDate(client.nextBillingDate)
      : parseCalendarDate(computeNextBillingDate(initialBillingDay))
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Modals state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeletePermanentModal, setShowDeletePermanentModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showAddPendingModal, setShowAddPendingModal] = useState(false);

  // Transaction count query for permanent delete modal (staleTime 0, rechecks when modal opens)
  const countQuery = useClientTransactionCount(client.id, showDeletePermanentModal);
  const isCountLoading = countQuery.isLoading || countQuery.isFetching;
  const isCountReady =
    countQuery.isSuccess && !countQuery.isFetching && !countQuery.isError && countQuery.data != null;
  const verifiedCount = isCountReady ? countQuery.data.count : null;

  // Linked transactions from overview
  const linkedTransactions = useMemo(() => {
    const list = overview?.transactions ?? [];
    return list
      .filter(
        (tx) =>
          tx.clientId === client.id ||
          (tx.sourceType === 'client' && tx.sourceId === client.id)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [overview, client.id]);

  const totalPaid = useMemo(() => {
    return getClientRevenue(overview?.transactions ?? [], client.id);
  }, [overview, client.id]);

  const isArchived = Boolean(client.archivedAt);
  const isRetainer = client.paymentType === 'retainer';
  const canRecordRetainer = isRetainer && client.status === 'ACTIVE' && !isArchived;

  const handleBillingDayChange = (text: string) => {
    setBillingDayStr(text);
    const parsed = parseLocalizedBillingDay(text);
    if (parsed.value != null) {
      setNextBillingDate(parseCalendarDate(computeNextBillingDate(parsed.value)));
    }
  };

  const handleSaveEdits = async () => {
    if (!isOnline || !onlineManager.isOnline() || updateMutation.isPending) return;

    setFieldErrors({});
    setGeneralError(null);
    setFeedbackSuccess(null);

    const validation = validateClientFormInput(
      {
        name,
        revenueStr,
        company,
        email,
        clientType,
        status,
        paymentType,
        paymentDate,
        billingDayStr,
        nextBillingDate,
        existingClient: {
          company: client.company,
          email: client.email,
        },
      },
      t as any,
      true
    );

    if (!validation.valid || !validation.payload) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: client.id, updates: validation.payload });
      setIsEditing(false);
      setFeedbackSuccess(t('common.actions.save'));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  const handleArchiveConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || archiveMutation.isPending) return;
    try {
      await archiveMutation.mutateAsync(client.id);
      setShowArchiveModal(false);
      router.back();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  const handleRestoreConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || restoreMutation.isPending) return;
    try {
      await restoreMutation.mutateAsync(client.id);
      setFeedbackSuccess(t('clients.actions.restore'));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  const handleDeletePermanentConfirm = async () => {
    if (!isOnline || !onlineManager.isOnline() || deletePermanentMutation.isPending) return;
    if (!client.archivedAt || !isCountReady || verifiedCount == null) return;
    try {
      await deletePermanentMutation.mutateAsync(client.id);
      setShowDeletePermanentModal(false);
      router.back();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  const handleRecordPaymentConfirm = async (todayIsoDate: string) => {
    if (!isOnline || !onlineManager.isOnline() || recordPaymentMutation.isPending) return;
    try {
      await recordPaymentMutation.mutateAsync({ id: client.id, today: todayIsoDate });
      setShowRecordPaymentModal(false);
      setFeedbackSuccess(t('clients.recordPayment.confirm'));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  const handleAddPendingConfirm = async (data: {
    clientId: string;
    amount: number;
    expectedDate: string;
    note?: string;
  }) => {
    if (!isOnline || !onlineManager.isOnline() || addPendingMutation.isPending) return;
    try {
      await addPendingMutation.mutateAsync(data);
      setShowAddPendingModal(false);
      setFeedbackSuccess(t('clients.pending.submit'));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  return (
    <ScreenContainer testID="client-detail-screen" edges={['top', 'bottom', 'left', 'right']} scrollable={false} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable
            testID="client-back-button"
            accessibilityRole="button"
            accessibilityLabel={t('clients.form.cancel')}
            onPress={() => router.back()}
            hitSlop={8}
            style={[styles.headerIconBtn, { backgroundColor: theme.colors.surfaceHover }]}
          >
            <ArrowLeft size={20} color={theme.colors.text} />
          </Pressable>

          <Text
            accessibilityRole="header"
            style={[theme.typography.h3, styles.headerTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {client.name}
          </Text>

          <Pressable
            testID="client-edit-toggle"
            accessibilityRole="button"
            accessibilityLabel={
              isEditing
                ? t('clients.form.cancel')
                : t('clients.actions.edit', { name: client.name })
            }
            onPress={() => setIsEditing((prev) => !prev)}
            hitSlop={8}
            style={[styles.headerIconBtn, { backgroundColor: theme.colors.surfaceHover }]}
          >
            {isEditing ? (
              <Check size={20} color={theme.colors.accent} />
            ) : (
              <Edit2 size={18} color={theme.colors.text} />
            )}
          </Pressable>
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
              message={t('clients.offline.banner')}
            />
          )}

          {Boolean(generalError) && (
            <Banner tone="error" message={generalError ?? undefined} />
          )}

          {Boolean(feedbackSuccess) && (
            <Banner tone="success" message={feedbackSuccess ?? undefined} />
          )}

          {/* Client Overview Card */}
          <ClientDetailOverview
            client={client}
            totalPaid={totalPaid}
            currency={currency}
          />

          {/* Quick Action Buttons */}
          <ClientDetailActions
            client={client}
            isOnline={isOnline}
            canRecordRetainer={canRecordRetainer}
            isArchived={isArchived}
            isRecording={recordPaymentMutation.isPending}
            isAddingPending={addPendingMutation.isPending}
            isArchiving={archiveMutation.isPending}
            isRestoring={restoreMutation.isPending}
            isDeletingPermanent={deletePermanentMutation.isPending}
            onRecordPayment={() => setShowRecordPaymentModal(true)}
            onAddPending={() => setShowAddPendingModal(true)}
            onArchive={() => setShowArchiveModal(true)}
            onRestore={handleRestoreConfirm}
            onDeletePermanent={() => setShowDeletePermanentModal(true)}
          />

          {/* Edit Form Section */}
          {isEditing && (
            <View
              style={[
                styles.editFormCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[theme.typography.h3, styles.sectionTitle, { color: theme.colors.text }]}
              >
                {t('clients.form.editTitle')}
              </Text>

              <ClientFormFields
                testIDPrefix="edit-client"
                name={name}
                onChangeName={setName}
                revenueStr={revenueStr}
                onChangeRevenueStr={setRevenueStr}
                company={company}
                onChangeCompany={setCompany}
                email={email}
                onChangeEmail={setEmail}
                clientType={clientType}
                onChangeClientType={setClientType}
                status={status}
                onChangeStatus={setStatus}
                paymentType={paymentType}
                onChangePaymentType={setPaymentType}
                paymentDate={paymentDate}
                onChangePaymentDate={setPaymentDate}
                billingDayStr={billingDayStr}
                onChangeBillingDayStr={handleBillingDayChange}
                nextBillingDate={nextBillingDate}
                onChangeNextBillingDate={setNextBillingDate}
                currency={currency}
                fieldErrors={fieldErrors}
                disabled={updateMutation.isPending}
              />

              <View style={styles.formActions}>
                <Button
                  variant="secondary"
                  onPress={() => setIsEditing(false)}
                  disabled={updateMutation.isPending}
                  style={styles.formActionBtn}
                  testID="edit-client-cancel-btn"
                >
                  {t('clients.form.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onPress={handleSaveEdits}
                  loading={updateMutation.isPending}
                  disabled={!isOnline || updateMutation.isPending}
                  style={styles.formActionBtn}
                  testID="client-save-button"
                >
                  {updateMutation.isPending ? t('clients.form.saving') : t('clients.form.save')}
                </Button>
              </View>
            </View>
          )}

          {/* Linked Transactions History */}
          <ClientTransactionHistory
            client={client}
            transactions={linkedTransactions}
            currency={currency}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Archive Modal */}
      <ArchiveClientModal
        visible={showArchiveModal}
        client={client}
        transactionCount={linkedTransactions.length}
        revenueTotal={totalPaid}
        currency={currency}
        isArchiving={archiveMutation.isPending}
        isOnline={isOnline}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setShowArchiveModal(false)}
      />

      {/* Permanent Delete Modal */}
      <PermanentDeleteModal
        visible={showDeletePermanentModal}
        client={client}
        transactionCount={verifiedCount}
        isLoadingCount={isCountLoading}
        isCountError={countQuery.isError}
        onRetryCount={() => countQuery.refetch()}
        revenueTotal={totalPaid}
        currency={currency}
        isDeleting={deletePermanentMutation.isPending}
        isOnline={isOnline}
        onConfirm={handleDeletePermanentConfirm}
        onCancel={() => setShowDeletePermanentModal(false)}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        visible={showRecordPaymentModal}
        client={client}
        currency={currency}
        isRecording={recordPaymentMutation.isPending}
        isOnline={isOnline}
        onConfirm={handleRecordPaymentConfirm}
        onCancel={() => setShowRecordPaymentModal(false)}
      />

      {/* Add Pending Payment Modal */}
      <AddPendingPaymentModal
        visible={showAddPendingModal}
        client={client}
        currency={currency}
        isSubmitting={addPendingMutation.isPending}
        isOnline={isOnline}
        onConfirm={handleAddPendingConfirm}
        onCancel={() => setShowAddPendingModal(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
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
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 12,
    minWidth: 140,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  backBtn: {
    minWidth: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerIconBtn: {
    width: 44,
    height: 44, // 44pt touch target
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  editFormCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  formActionBtn: {
    flex: 1,
    minHeight: 44,
  },
});
