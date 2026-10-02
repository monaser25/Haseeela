import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Client } from '@haseela/shared';
import { DollarSign, Calendar } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';
import { DatePickerField } from '../transactions/DatePickerField';
import { parseCalendarDate, formatCalendarDate } from '../../utils/calendarDate';

export interface RecordPaymentModalProps {
  visible: boolean;
  client: Client | null;
  currency: string;
  isRecording: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: (todayIsoDate: string) => void;
  onCancel: () => void;
  testID?: string;
}

export function RecordPaymentModal({
  visible,
  client,
  currency,
  isRecording,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'record-payment-modal',
}: RecordPaymentModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const hasScheduledDate = Boolean(client?.nextBillingDate);

  const [fallbackDate, setFallbackDate] = useState<Date>(() => new Date());

  // Prevent stale date after reopen
  useEffect(() => {
    if (visible) {
      setFallbackDate(new Date());
    }
  }, [visible, client?.id]);

  if (!visible || !client) return null;

  const handleConfirm = () => {
    if (!isOnline || !onlineManager.isOnline() || isRecording) return;
    const dateToRecord = hasScheduledDate && client.nextBillingDate
      ? client.nextBillingDate
      : formatCalendarDate(fallbackDate);
    onConfirm(dateToRecord);
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
                { backgroundColor: theme.colors.positiveTint },
              ]}
            >
              <DollarSign size={22} color={theme.colors.positiveText} />
            </View>
            <Text
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {t('clients.recordPayment.title')}
            </Text>
          </View>

          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {t('clients.recordPayment.description', { name: client.name })}
          </Text>

          <View
            style={[
              styles.amountCard,
              {
                backgroundColor: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[theme.typography.captionUpper, { color: theme.colors.textMuted }]}>
              {t('clients.form.amountLabel')}
            </Text>
            <Text
              style={[
                theme.typography.h2,
                styles.amountText,
                { color: theme.colors.positiveText },
              ]}
            >
              {formatCurrency(client.revenue, currency)}
            </Text>
          </View>

          {/* If scheduled date exists, show next period notice and do NOT show misleading picker */}
          {hasScheduledDate && client.nextBillingDate ? (
            <View
              style={[
                styles.scheduleInfoBox,
                {
                  backgroundColor: theme.colors.accentTint,
                  borderColor: theme.colors.border,
                },
              ]}
              testID="record-payment-schedule-info"
            >
              <View style={styles.scheduleRow}>
                <Calendar size={18} color={theme.colors.accent} />
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    { color: theme.colors.text, flex: 1 },
                  ]}
                >
                  {t('clients.recordPayment.scheduledDate', {
                    date: formatDate(parseCalendarDate(client.nextBillingDate), {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }),
                  })}
                </Text>
              </View>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary, marginTop: 4 },
                ]}
              >
                {t('clients.recordPayment.advanceNotice')}
              </Text>
            </View>
          ) : (
            <View>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted, marginBottom: 8 },
                ]}
              >
                {t('clients.recordPayment.noSchedule')}
              </Text>
              <DatePickerField
                label={t('clients.recordPayment.dateLabel')}
                value={fallbackDate}
                onChange={setFallbackDate}
                disabled={isRecording}
                testID="record-payment-date-picker"
              />
            </View>
          )}

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

          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={onCancel}
              disabled={isRecording}
              style={styles.actionBtn}
              testID="record-payment-cancel"
            >
              {t('clients.form.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              loading={isRecording}
              disabled={!isOnline || isRecording}
              style={styles.actionBtn}
              testID="record-payment-confirm"
            >
              {t('clients.recordPayment.confirm')}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
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
  amountCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 4,
  },
  amountText: {
    fontVariant: ['tabular-nums'],
  },
  scheduleInfoBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  offlineNotice: {
    textAlign: 'center',
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
