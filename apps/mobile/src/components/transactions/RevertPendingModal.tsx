import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { Transaction } from '@haseela/shared';
import { RotateCcw, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useIsOnline } from '../../query';
import { usePreferences } from '../../api';
import { Button } from '../ui';

export interface RevertPendingModalProps {
  visible: boolean;
  transaction: Transaction | null;
  currency?: string;
  onClose: () => void;
  onConfirm: (transactionId: string) => Promise<void>;
  isLoading?: boolean;
}

export function RevertPendingModal({
  visible,
  transaction,
  currency,
  onClose,
  onConfirm,
  isLoading = false,
}: RevertPendingModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();
  const isOnline = useIsOnline();
  const { data: preferences } = usePreferences();
  const activeCurrency = currency || preferences?.currency || 'USD';

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!transaction) return null;

  const handleConfirm = async () => {
    if (!isOnline || isLoading) return;
    try {
      setErrorMessage(null);
      await onConfirm(transaction.id);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('pending.toast.revertFailed'));
    }
  };

  const displayName = transaction.name || transaction.notes || t('transactions.labels.unnamed');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="revert-pending-modal"
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
                  { backgroundColor: theme.colors.warningTint },
                ]}
              >
                <RotateCcw size={20} color={theme.colors.warningText} />
              </View>
              <Text
                style={[theme.typography.h2, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('transactions.pending.revertConfirmTitle')}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={t('transactions.fab.close')}
              testID="revert-modal-close"
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
            {t('transactions.pending.revertConfirmDesc')}
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
            <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
              {displayName}
            </Text>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textMuted, marginTop: 4 },
              ]}
              testID="revert-modal-amount"
            >
              {formatCurrency(transaction.amount, activeCurrency)}
            </Text>
          </View>

          {!isOnline && (
            <Text
              style={[theme.typography.small, styles.errorText, { color: theme.colors.warningText }]}
              testID="revert-modal-offline-warning"
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
              testID="revert-modal-cancel"
              style={styles.actionBtn}
            >
              {t('transactions.form.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              disabled={isLoading || !isOnline}
              loading={isLoading}
              testID="revert-modal-confirm"
              style={styles.actionBtn}
            >
              {t('transactions.pending.revert')}
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
