import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { Transaction } from '@haseela/shared';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useIsOnline } from '../../query';
import { usePreferences } from '../../api';
import { Button } from '../ui';

export interface DeleteTransactionModalProps {
  visible: boolean;
  transaction: Transaction | null;
  currency?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
  error?: string | null;
}

export function DeleteTransactionModal({
  visible,
  transaction,
  currency,
  onClose,
  onConfirm,
  isDeleting = false,
  error,
}: DeleteTransactionModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();
  const isOnline = useIsOnline();
  const { data: preferences } = usePreferences();
  const activeCurrency = currency || preferences?.currency || 'USD';

  if (!transaction) return null;

  const handleConfirm = async () => {
    if (!isOnline || isDeleting) return;
    await onConfirm();
  };

  const isAuto = Boolean(transaction.isAuto) || transaction.sourceType !== 'manual';
  const description = isAuto
    ? t('transactions.delete.descAuto')
    : t('transactions.delete.descManual');

  const title = transaction.name || transaction.notes || t('transactions.labels.unnamed');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="delete-transaction-modal"
    >
      <Pressable style={styles.backdrop} onPress={isDeleting ? undefined : onClose}>
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
            <View style={styles.iconCircle}>
              <AlertTriangle size={24} color={theme.colors.negativeText} />
            </View>
            <View style={styles.headerTextCol}>
              <Text
                style={[theme.typography.h2, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('transactions.delete.title')}
              </Text>
              <Text
                style={[
                  theme.typography.small,
                  { color: theme.colors.textSecondary, marginTop: 4 },
                ]}
              >
                {description}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
              {title}
            </Text>
            <Text
              style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}
              testID="delete-modal-amount"
            >
              {formatCurrency(transaction.amount, activeCurrency)}
            </Text>
          </View>

          {!isOnline && (
            <Text
              style={[theme.typography.small, styles.errorText, { color: theme.colors.warningText }]}
              testID="delete-modal-offline-warning"
            >
              {t('transactions.offline.deleteDisabled')}
            </Text>
          )}

          {error && (
            <Text style={[theme.typography.small, styles.errorText, { color: theme.colors.negativeText }]}>
              {error}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <Button
              variant="secondary"
              onPress={onClose}
              disabled={isDeleting}
              testID="delete-modal-cancel"
              style={styles.actionBtn}
            >
              {t('transactions.delete.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              disabled={isDeleting || !isOnline}
              loading={isDeleting}
              testID="delete-modal-confirm"
              style={[
                styles.actionBtn,
                { backgroundColor: theme.colors.negative },
              ]}
            >
              {isDeleting ? t('transactions.delete.deleting') : t('transactions.delete.confirm')}
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
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
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
