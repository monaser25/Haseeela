import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Subscription } from '@haseela/shared';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface PermanentDeleteSubscriptionModalProps {
  visible: boolean;
  subscription: Subscription | null;
  isDeleting: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function PermanentDeleteSubscriptionModal({
  visible,
  subscription,
  isDeleting,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'permanent-delete-subscription-modal',
}: PermanentDeleteSubscriptionModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  if (!visible || !subscription) return null;

  const handleConfirm = () => {
    if (!isOnline || !onlineManager.isOnline() || isDeleting) return;
    onConfirm();
  };

  const handleDismiss = () => {
    if (isDeleting) return;
    onCancel();
  };

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
                { backgroundColor: theme.colors.negativeTint },
              ]}
            >
              <AlertTriangle size={22} color={theme.colors.negative} />
            </View>
            <Text
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {t('subscriptions.permanentDelete.title', { name: subscription.name })}
            </Text>
          </View>

          <Text
            testID="subscription-permanent-delete-warning"
            style={[
              theme.typography.body,
              styles.warningText,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('subscriptions.permanentDelete.warning')}
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
              testID="subscription-permanent-delete-cancel"
              variant="secondary"
              onPress={handleDismiss}
              disabled={isDeleting}
              style={styles.actionBtn}
            >
              {t('subscriptions.form.cancel')}
            </Button>
            <Button
              testID="subscription-permanent-delete-confirm"
              variant="primary"
              onPress={handleConfirm}
              loading={isDeleting}
              disabled={!isOnline || !onlineManager.isOnline() || isDeleting}
              style={[styles.actionBtn, { backgroundColor: theme.colors.negative }]}
            >
              {t('subscriptions.permanentDelete.confirm')}
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
  warningText: {
    lineHeight: 20,
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
