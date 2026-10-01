import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Client } from '@haseela/shared';
import { pendingPaymentCreateSchema } from '@haseela/shared';
import { Clock } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button, TextField } from '../ui';
import { DatePickerField } from '../transactions/DatePickerField';
import { parseLocaleAmount } from '../transactions/parseAmount';
import { formatCalendarDate } from '../../utils/calendarDate';
import { mapZodErrorToKeys } from './clientValidation';

export interface AddPendingPaymentModalProps {
  visible: boolean;
  client: Client | null;
  currency: string;
  isSubmitting: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: (data: { clientId: string; amount: number; expectedDate: string; note?: string }) => void;
  onCancel: () => void;
  testID?: string;
}

export function AddPendingPaymentModal({
  visible,
  client,
  currency,
  isSubmitting,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'add-pending-payment-modal',
}: AddPendingPaymentModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [amountStr, setAmountStr] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date>(() => new Date());
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset inputs when modal closes successfully, but preserve failed inputs on error
  useEffect(() => {
    if (!visible && !error) {
      setAmountStr('');
      setExpectedDate(new Date());
      setNote('');
      setFieldErrors({});
    }
  }, [visible, error]);

  if (!visible || !client) return null;

  const handleSubmit = () => {
    if (!isOnline || !onlineManager.isOnline() || isSubmitting) return;

    setFieldErrors({});

    const numericAmount = parseLocaleAmount(amountStr);
    const dateStr = formatCalendarDate(expectedDate);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFieldErrors({ amount: t('clients.validation.amountInvalid') });
      return;
    }

    const payload = {
      clientId: client.id,
      amount: numericAmount,
      expectedDate: dateStr,
      note: note.trim() || undefined,
    };

    const parsed = pendingPaymentCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const zodKeyMap = mapZodErrorToKeys(parsed.error);
      const errs: Record<string, string> = {};
      for (const [field, key] of Object.entries(zodKeyMap)) {
        errs[field] = t(key as any);
      }
      setFieldErrors(errs);
      return;
    }

    onConfirm({
      clientId: client.id,
      amount: numericAmount,
      expectedDate: dateStr,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
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
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.warningTint },
                ]}
              >
                <Clock size={22} color={theme.colors.warningText} />
              </View>
              <Text
                style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('clients.pending.title')}
              </Text>
            </View>

            <ScrollView bounces={false} contentContainerStyle={styles.formContent}>
              <TextField
                label={`${t('clients.pending.amount')} (${currency})`}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0.00"
                keyboardType="decimal-pad"
                error={fieldErrors.amount}
                testID="pending-amount-input"
              />

              <DatePickerField
                label={t('clients.pending.date')}
                value={expectedDate}
                onChange={setExpectedDate}
                disabled={isSubmitting}
                testID="pending-date-picker"
              />

              <TextField
                label={t('clients.pending.note')}
                value={note}
                onChangeText={setNote}
                placeholder=""
                testID="pending-note-input"
              />

              {Boolean(error) && (
                <View
                  style={[
                    styles.errorBox,
                    {
                      backgroundColor: theme.colors.negativeTint,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[theme.typography.small, { color: theme.colors.negativeText }]}>
                    {error}
                  </Text>
                </View>
              )}

              {!isOnline && (
                <Text
                  style={[
                    theme.typography.caption,
                    styles.offlineNotice,
                    { color: theme.colors.warningText },
                  ]}
                >
                  {t('clients.offline.actionDisabled')}
                </Text>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <Button
                variant="secondary"
                onPress={onCancel}
                disabled={isSubmitting}
                style={styles.actionBtn}
                testID="pending-cancel-btn"
              >
                {t('clients.form.cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!isOnline || isSubmitting}
                style={styles.actionBtn}
                testID="pending-submit-btn"
              >
                {t('clients.pending.submit')}
              </Button>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: 440,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  formContent: {
    gap: 6,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  offlineNotice: {
    textAlign: 'center',
    marginVertical: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44, // 44pt target
  },
});
