import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Subscription, CurrencyCode } from '@haseela/shared';
import { CreditCard, Calendar } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';
import { parseCalendarDate } from '../../utils/calendarDate';

export interface RecordSubscriptionPaymentModalProps {
  visible: boolean;
  subscription: Subscription | null;
  currency: CurrencyCode;
  isRecording: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function RecordSubscriptionPaymentModal({
  visible,
  subscription,
  currency,
  isRecording,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'record-subscription-payment-modal',
}: RecordSubscriptionPaymentModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  if (!visible || !subscription) return null;

  const handleConfirm = () => {
    if (!isOnline || !onlineManager.isOnline() || isRecording) return;
    onConfirm();
  };

  const handleDismiss = () => {
    if (isRecording) return;
    onCancel();
  };

  const formattedDate = subscription.nextBillingDate
    ? formatDate(parseCalendarDate(subscription.nextBillingDate), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
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
                { backgroundColor: theme.colors.accentTint },
              ]}
            >
              <CreditCard size={22} color={theme.colors.accent} />
            </View>
            <Text
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {t('subscriptions.recordPayment.title')}
            </Text>
          </View>

          <Text
            style={[
              theme.typography.body,
              styles.description,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('subscriptions.recordPayment.description', {
              name: subscription.name,
            })}
          </Text>

          {/* Scheduled Billing Period Display — NO misleading date picker */}
          <View
            style={[
              styles.scheduledBox,
              {
                backgroundColor: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Calendar size={18} color={theme.colors.accent} style={styles.calIcon} />
            <View style={styles.scheduledContent}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted },
                ]}
              >
                {t('subscriptions.recordPayment.scheduledDate', {
                  date: formattedDate,
                })}
              </Text>
              <Text
                testID="record-payment-amount"
                style={[
                  theme.typography.bodySemiBold,
                  { color: theme.colors.negative, marginTop: 2 },
                ]}
              >
                {formatCurrency(subscription.amount, currency)}
              </Text>
            </View>
          </View>

          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, lineHeight: 18 },
            ]}
          >
            {t('subscriptions.recordPayment.advanceNotice')}
          </Text>

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
              <Text
                style={[
                  theme.typography.small,
                  { color: theme.colors.negativeText },
                ]}
              >
                {error}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              testID="subscription-record-payment-cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={isRecording}
              style={styles.actionBtn}
            >
              {t('subscriptions.form.cancel')}
            </Button>
            <Button
              testID="subscription-record-payment-confirm"
              variant="primary"
              onPress={handleConfirm}
              loading={isRecording}
              disabled={!isOnline || !onlineManager.isOnline() || isRecording}
              style={styles.actionBtn}
            >
              {t('subscriptions.recordPayment.confirm')}
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
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
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
  description: {
    lineHeight: 20,
  },
  scheduledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  calIcon: {
    marginEnd: 12,
  },
  scheduledContent: {
    flex: 1,
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
  },
});
