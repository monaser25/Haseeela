import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { Transaction } from '@haseela/shared';
import { CheckCircle2, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useIsOnline } from '../../query';
import { usePreferences } from '../../api';
import { Button } from '../ui';
import { DatePickerField } from './DatePickerField';
import { formatCalendarDate } from '../../utils/calendarDate';

export interface CompletePendingModalProps {
  visible: boolean;
  transaction: Transaction | null;
  clientName?: string;
  currency?: string;
  onClose: () => void;
  onConfirm: (transactionId: string, completedDate: string) => Promise<void>;
  isLoading?: boolean;
}

export function CompletePendingModal({
  visible,
  transaction,
  clientName,
  currency,
  onClose,
  onConfirm,
  isLoading = false,
}: CompletePendingModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();
  const isOnline = useIsOnline();
  const { data: preferences } = usePreferences();
  const activeCurrency = currency || preferences?.currency || 'USD';

  const [completedDate, setCompletedDate] = useState<Date>(() => new Date());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!transaction) return null;

  const handleConfirm = async () => {
    if (!isOnline || isLoading) return;
    try {
      setErrorMessage(null);
      const isoDate = formatCalendarDate(completedDate);
      await onConfirm(transaction.id, isoDate);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('pending.toast.revertFailed'));
    }
  };

  const displayName = clientName || transaction.name || t('transactions.labels.unnamed');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="complete-pending-modal"
    >
      <Pressable style={styles.backdrop} onPress={isLoading ? undefined : onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e?.stopPropagation?.()}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.colors.positiveTint },
                ]}
              >
                <CheckCircle2 size={22} color={theme.colors.positiveText} />
              </View>
              <Text
                style={[theme.typography.h2, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('pending.confirmPaid.title')}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={t('transactions.fab.close')}
              testID="complete-modal-close"
              hitSlop={8}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.colors.surfaceHover },
              ]}
            >
              <X size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[theme.typography.body, styles.description, { color: theme.colors.textSecondary }]}>
            {t('pending.confirmPaid.desc', { client: displayName })}
          </Text>

          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[theme.typography.small, { color: theme.colors.textMuted }]}>
              {t('pending.confirmPaid.amount')}
            </Text>
            <Text
              style={[
                theme.typography.h1,
                { color: theme.colors.positiveText, marginTop: 2 },
              ]}
              testID="complete-modal-amount"
            >
              {formatCurrency(transaction.amount, activeCurrency)}
            </Text>
          </View>

          <DatePickerField
            label={t('pending.confirmPaid.completionDateLabel')}
            value={completedDate}
            onChange={setCompletedDate}
            disabled={isLoading}
            testID="completion-date-picker"
          />

          {!isOnline && (
            <Text
              style={[theme.typography.small, styles.errorText, { color: theme.colors.warningText }]}
              testID="complete-modal-offline-warning"
            >
              {t('transactions.offline.saveDisabled')}
            </Text>
          )}

          {errorMessage && (
            <Text style={[theme.typography.small, styles.errorText, { color: theme.colors.negativeText }]}>
              {errorMessage}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <Button
              variant="secondary"
              onPress={onClose}
              disabled={isLoading}
              testID="complete-modal-cancel"
              style={styles.actionBtn}
            >
              {t('pending.confirmPaid.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              disabled={isLoading || !isOnline}
              loading={isLoading}
              testID="complete-modal-confirm"
              style={styles.actionBtn}
            >
              {t('pending.confirmPaid.confirm')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    marginBottom: 16,
  },
  infoBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
  },
});
