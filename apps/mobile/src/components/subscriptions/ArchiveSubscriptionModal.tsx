import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Subscription, CurrencyCode } from '@haseela/shared';
import { Archive, Info } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface ArchiveSubscriptionModalProps {
  visible: boolean;
  subscription: Subscription | null;
  transactionCount: number;
  currency: CurrencyCode;
  isArchiving: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function ArchiveSubscriptionModal({
  visible,
  subscription,
  transactionCount,
  currency,
  isArchiving,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'archive-subscription-modal',
}: ArchiveSubscriptionModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  if (!visible || !subscription) return null;

  const handleConfirm = () => {
    if (!isOnline || !onlineManager.isOnline() || isArchiving) return;
    onConfirm();
  };

  const handleDismiss = () => {
    if (isArchiving) return;
    onCancel();
  };

  const pastNotice =
    transactionCount === 1
      ? t('subscriptions.delete.pastNotice', { count: '1' })
      : t('subscriptions.delete.pastNoticePlural', {
          count: String(transactionCount),
        });

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
              <Archive size={22} color={theme.colors.accent} />
            </View>
            <Text
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {t('subscriptions.archive.title', { name: subscription.name })}
            </Text>
          </View>

          <Text
            style={[
              theme.typography.body,
              styles.description,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('subscriptions.delete.desc')}
          </Text>

          {/* External cancellation disclaimer */}
          <View
            style={[
              styles.disclaimerBox,
              {
                backgroundColor: theme.colors.warningTint,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Info
              size={16}
              color={theme.colors.warning}
              style={styles.disclaimerIcon}
            />
            <Text
              style={[
                theme.typography.small,
                { color: theme.colors.warningText, flex: 1 },
              ]}
            >
              {t('subscriptions.archive.disclaimer')}
            </Text>
          </View>

          {transactionCount > 0 && (
            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor: theme.colors.infoTint,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.small,
                  { color: theme.colors.infoText },
                ]}
              >
                {pastNotice}
              </Text>
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
              testID="subscription-archive-cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={isArchiving}
              style={styles.actionBtn}
            >
              {t('subscriptions.form.cancel')}
            </Button>
            <Button
              testID="subscription-archive-confirm"
              variant="primary"
              onPress={handleConfirm}
              loading={isArchiving}
              disabled={!isOnline || !onlineManager.isOnline() || isArchiving}
              style={styles.actionBtn}
            >
              {t('subscriptions.archive.confirm')}
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
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  disclaimerIcon: {
    marginEnd: 8,
    marginTop: 2,
  },
  infoBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
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
