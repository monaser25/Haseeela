import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { Transaction } from '@haseela/shared';
import {
  categoryLabel,
  daysOverdue,
  TransactionSchema,
  pendingPaymentUpdateSchema,
} from '@haseela/shared';
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import {
  useOverview,
  usePreferences,
  useUpdateTransaction,
  useDeleteTransaction,
  useUpdatePendingPayment,
  useDeletePendingPayment,
  useCompletePendingPayment,
  useRevertPendingPayment,
} from '../../../api';
import { useIsOnline } from '../../../query';
import { TextField, Button, Banner, ScreenContainer } from '../../../components/ui';
import { DatePickerField } from '../../../components/transactions/DatePickerField';
import { DeleteTransactionModal } from '../../../components/transactions/DeleteTransactionModal';
import { CompletePendingModal } from '../../../components/transactions/CompletePendingModal';
import { RevertPendingModal } from '../../../components/transactions/RevertPendingModal';
import { parseLocaleAmount } from '../../../components/transactions/parseAmount';
import { parseCalendarDate, formatCalendarDate } from '../../../utils/calendarDate';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const { theme } = useTheme();
  const { t } = useI18n();

  const { data: overview, isLoading } = useOverview();

  const transaction = useMemo(
    () => overview?.transactions.find((item) => item.id === id) ?? null,
    [overview, id]
  );

  if (isLoading && !transaction) {
    return (
      <ScreenContainer testID="tx-detail-loading" edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
            {t('common.actions.save')}...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!transaction) {
    return (
      <ScreenContainer testID="tx-not-found" edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.notFoundContainer}>
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>
            {t('transactions.empty.title')}
          </Text>
          <Button variant="secondary" onPress={() => router.back()} style={styles.backBtn}>
            {t('transactions.form.cancel')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // Mount keyed loaded editor to initialize exactly once per loaded transaction
  // and preserve user edits during background refetches.
  return <TransactionEditor key={transaction.id} transaction={transaction} />;
}

interface TransactionEditorProps {
  transaction: Transaction;
}

function TransactionEditor({ transaction }: TransactionEditorProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();
  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';

  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const updatePendingMutation = useUpdatePendingPayment();
  const deletePendingMutation = useDeletePendingPayment();
  const completePendingMutation = useCompletePendingPayment();
  const revertPendingMutation = useRevertPendingPayment();

  const isPending = transaction.status === 'PENDING';
  const isAuto = Boolean(transaction.isAuto) || transaction.sourceType !== 'manual';
  const canRevert = transaction.status === 'COMPLETED' && Boolean(transaction.expectedDate);
  const overdueDays = isPending ? daysOverdue(transaction) : 0;

  // Initialize form state once on mount.
  // For pending transactions, expectedDate must be initialized ahead of date.
  const initialDateStr = isPending
    ? (transaction.expectedDate || transaction.date)
    : (transaction.date || transaction.expectedDate);

  const [name, setName] = useState(transaction.name || transaction.notes || '');
  const [amountStr, setAmountStr] = useState(
    transaction.amount != null ? String(transaction.amount) : ''
  );
  const [date, setDate] = useState<Date>(() => parseCalendarDate(initialDateStr));
  const [notes, setNotes] = useState(transaction.notes || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);

  const isSaving = updateMutation.isPending || updatePendingMutation.isPending;
  const isDeleting = deleteMutation.isPending || deletePendingMutation.isPending;

  const handleSave = async () => {
    if (!isOnline || isSaving) return;

    setFieldErrors({});
    setGeneralError(null);

    const numericAmount = parseLocaleAmount(amountStr);

    if (isPending) {
      // Validate pending payment update shape with shared pendingPaymentUpdateSchema
      const pendingPayload = {
        amount: numericAmount,
        expectedDate: formatCalendarDate(date),
        note: notes.trim() || undefined,
      };

      const validationResult = pendingPaymentUpdateSchema.safeParse(pendingPayload);
      if (!validationResult.success) {
        const errors: Record<string, string> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path[0]?.toString();
          if (field && !errors[field]) {
            if (field === 'amount' && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
              errors.amount = t('transactions.form.errorNameAmount');
            } else {
              errors[field] = err.message;
            }
          }
        });
        setFieldErrors(errors);
        return;
      }

      try {
        await updatePendingMutation.mutateAsync({
          id: transaction.id,
          updates: {
            amount: numericAmount,
            expectedDate: formatCalendarDate(date),
            note: notes.trim() || undefined,
          },
        });
        router.back();
      } catch (err) {
        setGeneralError(err instanceof Error ? err.message : t('transactions.form.errorUpdate'));
      }
    } else {
      // Validate standard transaction update shape respecting backend immutable-field rules
      const updatePayload = {
        name: name.trim(),
        amount: numericAmount,
        date: formatCalendarDate(date),
        notes: notes.trim() || undefined,
      };

      const validationResult = TransactionSchema.pick({
        name: true,
        amount: true,
        date: true,
        notes: true,
      }).safeParse(updatePayload);

      if (!validationResult.success) {
        const errors: Record<string, string> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path[0]?.toString();
          if (field && !errors[field]) {
            if (field === 'amount' && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
              errors.amount = t('transactions.form.errorNameAmount');
            } else if (field === 'name' && !name.trim()) {
              errors.name = t('transactions.form.errorNameAmount');
            } else {
              errors[field] = err.message;
            }
          }
        });
        setFieldErrors(errors);
        return;
      }

      try {
        await updateMutation.mutateAsync({
          id: transaction.id,
          updates: {
            name: name.trim(),
            amount: numericAmount,
            date: formatCalendarDate(date),
            notes: notes.trim() || undefined,
          },
        });
        router.back();
      } catch (err) {
        setGeneralError(err instanceof Error ? err.message : t('transactions.form.errorUpdate'));
      }
    }
  };

  const handleDelete = async () => {
    if (!isOnline || isDeleting) return;
    try {
      if (isPending) {
        await deletePendingMutation.mutateAsync(transaction.id);
      } else {
        await deleteMutation.mutateAsync(transaction.id);
      }
      setShowDeleteModal(false);
      router.back();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('transactions.delete.error'));
      setShowDeleteModal(false);
    }
  };

  const handleComplete = async (_txId: string, completedDate: string) => {
    if (!isOnline || completePendingMutation.isPending) return;
    await completePendingMutation.mutateAsync({
      id: transaction.id,
      data: { completedDate },
    });
    setShowCompleteModal(false);
    router.back();
  };

  const handleRevert = async (_txId: string) => {
    if (!isOnline || revertPendingMutation.isPending) return;
    await revertPendingMutation.mutateAsync(transaction.id);
    setShowRevertModal(false);
    router.back();
  };

  return (
    <ScreenContainer
      testID="transaction-detail-screen"
      edges={['top', 'bottom', 'left', 'right']}
      showOfflineBanner={false}
      scrollable={false}
      padded={false}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text
                style={[theme.typography.h1, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('transactions.form.editTitle')}
              </Text>
              <Text style={[theme.typography.small, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {t('transactions.form.editSubtitle')}
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('transactions.fab.close')}
              testID="tx-detail-close"
              hitSlop={8}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.colors.surfaceHover },
              ]}
            >
              <X size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Offline notice */}
          {!isOnline && (
            <View style={styles.bannerSpacing}>
              <Banner
                tone="warning"
                title={t('offline.title')}
                message={t('transactions.offline.saveDisabled')}
                testID="offline-banner"
              />
            </View>
          )}

          {/* Auto-generated / recurring transaction warning (mirroring web transactions page) */}
          {isAuto && (
            <View style={styles.bannerSpacing}>
              <Banner
                tone="warning"
                title={t('transactions.badges.auto')}
                message={t('transactions.form.autoWarning')}
                testID="auto-warning-banner"
              />
            </View>
          )}

          {/* General error */}
          {generalError && (
            <View style={styles.bannerSpacing}>
              <Banner tone="error" title={generalError} testID="general-error-banner" />
            </View>
          )}

          {/* Pending Status Badge & Quick Action */}
          {isPending && (
            <View
              style={[
                styles.pendingCard,
                {
                  backgroundColor: overdueDays > 0 ? theme.colors.negativeTint : theme.colors.warningTint,
                  borderColor: overdueDays > 0 ? theme.colors.negative : theme.colors.warning,
                },
              ]}
              testID="pending-status-card"
            >
              <View style={styles.pendingCardRow}>
                {overdueDays > 0 ? (
                  <AlertCircle size={20} color={theme.colors.negativeText} />
                ) : (
                  <Clock size={20} color={theme.colors.warningText} />
                )}
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    { color: overdueDays > 0 ? theme.colors.negativeText : theme.colors.warningText },
                  ]}
                >
                  {overdueDays > 0
                    ? overdueDays === 1
                      ? t('pending.badge.overdue', { days: 1 })
                      : t('pending.badge.overduePlural', { days: overdueDays })
                    : t('transactions.status.pending')}
                </Text>
              </View>

              <Button
                variant="primary"
                onPress={() => setShowCompleteModal(true)}
                testID="detail-mark-as-paid"
                style={{ backgroundColor: theme.colors.positive, marginTop: 10 }}
              >
                {t('transactions.pending.markAsReceived')}
              </Button>
            </View>
          )}

          {/* Revert to Pending Quick Action */}
          {canRevert && (
            <View
              style={[
                styles.revertCard,
                {
                  backgroundColor: theme.colors.surfaceHover,
                  borderColor: theme.colors.border,
                },
              ]}
              testID="revert-status-card"
            >
              <View style={styles.pendingCardRow}>
                <CheckCircle2 size={18} color={theme.colors.positiveText} />
                <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                  {t('transactions.status.completed')}
                </Text>
              </View>

              <Button
                variant="secondary"
                onPress={() => setShowRevertModal(true)}
                testID="detail-revert-to-pending"
                style={{ marginTop: 8 }}
              >
                {t('transactions.pending.revert')}
              </Button>
            </View>
          )}

          {/* Name Field */}
          <TextField
            label={t('transactions.form.nameLabel')}
            placeholder={t('transactions.form.namePlaceholder')}
            value={name}
            onChangeText={setName}
            error={fieldErrors.name}
            testID="tx-name-input"
          />

          {/* Amount Field */}
          <TextField
            label={t('transactions.form.amountLabel')}
            placeholder="0.00"
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            error={fieldErrors.amount}
            testID="tx-amount-input"
          />

          {/* Date Picker */}
          <DatePickerField
            label={t('transactions.form.dateLabel')}
            value={date}
            onChange={setDate}
            testID="tx-date-picker"
          />

          {/* Locked Category Display for existing / auto transactions */}
          <View style={styles.lockedCategoryContainer}>
            <Text style={[theme.typography.captionUpper, styles.fieldLabel, { color: theme.colors.textMuted }]}>
              {t('transactions.form.catLabel')}
            </Text>
            <View
              style={[
                styles.lockedCategoryBox,
                {
                  backgroundColor: theme.colors.surfaceHover,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text }]}>
                {categoryLabel(transaction.categoryId, (k) => t(k))}
              </Text>
              <Lock size={16} color={theme.colors.textMuted} />
            </View>
          </View>

          {/* Notes */}
          <TextField
            label={t('transactions.form.notesLabel')}
            placeholder={t('transactions.form.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            testID="tx-notes-input"
          />

          {/* Action Buttons: Save and Delete */}
          <View style={styles.actionsContainer}>
            <View style={styles.actionsRow}>
              <Button
                variant="secondary"
                onPress={() => router.back()}
                testID="tx-cancel-button"
                style={styles.actionBtn}
              >
                {t('transactions.form.cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleSave}
                disabled={!isOnline || isSaving}
                loading={isSaving}
                testID="tx-save-button"
                style={styles.actionBtn}
              >
                {isSaving ? t('transactions.form.saving') : t('transactions.form.saveChanges')}
              </Button>
            </View>

            <Button
              variant="secondary"
              onPress={() => setShowDeleteModal(true)}
              disabled={!isOnline || isDeleting}
              testID="tx-delete-button"
              style={[styles.deleteBtn, { borderColor: theme.colors.negativeText }]}
              textStyle={{ color: theme.colors.negativeText }}
            >
              {t('transactions.actions.delete')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete Confirmation Modal */}
      <DeleteTransactionModal
        visible={showDeleteModal}
        transaction={transaction}
        currency={currency}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      {/* Pending Complete Modal */}
      <CompletePendingModal
        visible={showCompleteModal}
        transaction={transaction}
        currency={currency}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={handleComplete}
        isLoading={completePendingMutation.isPending}
      />

      {/* Pending Revert Modal */}
      <RevertPendingModal
        visible={showRevertModal}
        transaction={transaction}
        currency={currency}
        onClose={() => setShowRevertModal(false)}
        onConfirm={handleRevert}
        isLoading={revertPendingMutation.isPending}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  backBtn: {
    width: 'auto',
    minWidth: 120,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTextCol: {
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSpacing: {
    marginBottom: 16,
  },
  pendingCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  revertCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  pendingCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedCategoryContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  lockedCategoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionsContainer: {
    marginTop: 20,
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
  deleteBtn: {
    width: '100%',
  },
});
