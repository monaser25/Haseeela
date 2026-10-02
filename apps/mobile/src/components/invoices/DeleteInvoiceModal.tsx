import React from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { AlertTriangle, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface DeleteInvoiceModalProps {
  visible: boolean;
  invoiceNumber: string;
  isDeleting: boolean;
  error?: string | null;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function DeleteInvoiceModal({
  visible,
  invoiceNumber,
  isDeleting,
  error,
  disabled = false,
  onConfirm,
  onCancel,
  testID = 'delete-invoice-modal',
}: DeleteInvoiceModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isDeleting ? undefined : onCancel}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.negativeTint }]}>
              <AlertTriangle size={24} color={theme.colors.negative} />
            </View>
            <Text
              accessibilityRole="header"
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
            >
              {t('invoices.deleteDialog.title')}
            </Text>
          </View>

          <Text style={[theme.typography.body, styles.description, { color: theme.colors.textSecondary }]}>
            {t('invoices.deleteDialog.description', { number: invoiceNumber })}
          </Text>

          {/* Honest income retained notice */}
          <View
            testID="income-retained-warning"
            style={[
              styles.warningBox,
              {
                backgroundColor: theme.colors.warningTint,
                borderColor: theme.colors.warning,
                borderRadius: theme.radius.sm,
              },
            ]}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.warningText }]}>
              {t('invoices.deleteDialog.retainsIncomeWarning')}
            </Text>
          </View>

          {Boolean(error) && (
            <View
              testID="delete-invoice-error-banner"
              style={[
                styles.errorBox,
                {
                  backgroundColor: theme.colors.negativeTint,
                  borderColor: theme.colors.negative,
                  borderRadius: theme.radius.sm,
                },
              ]}
            >
              <AlertCircle size={18} color={theme.colors.negative} />
              <Text
                style={[
                  theme.typography.small,
                  styles.errorText,
                  { color: theme.colors.negativeText },
                ]}
              >
                {error}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={onCancel}
              disabled={isDeleting}
              testID="cancel-delete-invoice-btn"
            >
              {t('invoices.send.cancel')}
            </Button>
            <Button
              variant="primary"
              style={{ backgroundColor: theme.colors.negative }}
              onPress={onConfirm}
              loading={isDeleting}
              disabled={isDeleting || disabled}
              testID="confirm-delete-invoice-btn"
            >
              {t('invoices.deleteDialog.confirm')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  description: {
    lineHeight: 20,
  },
  warningBox: {
    padding: 10,
    borderWidth: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
});
