import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Client } from '@haseela/shared';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface PermanentDeleteModalProps {
  visible: boolean;
  client: Client | null;
  transactionCount: number | null;
  isLoadingCount: boolean;
  isCountError: boolean;
  onRetryCount: () => void;
  revenueTotal?: number;
  currency: string;
  isDeleting: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function PermanentDeleteModal({
  visible,
  client,
  transactionCount,
  isLoadingCount,
  isCountError,
  onRetryCount,
  revenueTotal = 0,
  currency,
  isDeleting,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'permanent-delete-modal',
}: PermanentDeleteModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  if (!visible || !client) return null;

  const countReady = transactionCount !== null && !isLoadingCount && !isCountError;

  const deleteNotice = countReady
    ? transactionCount === 1
      ? t('clients.delete.deleteNotice', {
          count: '1',
          amount: formatCurrency(revenueTotal, currency),
        })
      : t('clients.delete.deleteNoticePlural', {
          count: String(transactionCount),
          amount: formatCurrency(revenueTotal, currency),
        })
    : '';

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
                { backgroundColor: theme.colors.negativeTint },
              ]}
            >
              <Trash2 size={22} color={theme.colors.negativeText} />
            </View>
            <Text
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {t('clients.delete.deletePermanently')}
            </Text>
          </View>

          <Text style={[theme.typography.body, styles.description, { color: theme.colors.textSecondary }]}>
            {t('clients.delete.desc')}
          </Text>

          {/* Transaction Count State: Loading, Error, or Exact Count Warning */}
          {isLoadingCount ? (
            <View style={styles.loadingBox} testID="delete-count-loading">
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>
                {t('clients.delete.countLoading')}
              </Text>
            </View>
          ) : isCountError || transactionCount === null ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: theme.colors.negativeTint,
                  borderColor: theme.colors.negative,
                },
              ]}
              testID="delete-count-error"
            >
              <Text style={[theme.typography.small, { color: theme.colors.negativeText }]}>
                {t('clients.delete.countError')}
              </Text>
              <Button
                variant="secondary"
                onPress={onRetryCount}
                style={styles.retryBtn}
                testID="delete-count-retry-btn"
              >
                {t('clients.delete.countRetry')}
              </Button>
            </View>
          ) : (
            <View
              style={[
                styles.warningBox,
                {
                  backgroundColor: theme.colors.negativeTint,
                  borderColor: theme.colors.negative,
                },
              ]}
              testID="delete-count-ready"
            >
              <Text
                style={[
                  theme.typography.small,
                  { color: theme.colors.negativeText, fontWeight: '600' },
                ]}
              >
                {deleteNotice}
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
              disabled={isDeleting}
              style={styles.actionBtn}
              testID="permanent-delete-cancel"
            >
              {t('clients.delete.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                if (!isOnline || !onlineManager.isOnline() || isDeleting || !countReady) return;
                onConfirm();
              }}
              loading={isDeleting}
              disabled={!isOnline || !onlineManager.isOnline() || isDeleting || !countReady}
              style={[styles.actionBtn, { backgroundColor: theme.colors.negative }]}
              testID="permanent-delete-confirm"
            >
              {isDeleting ? t('clients.delete.deleting') : t('clients.delete.deletePermanently')}
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
  description: {
    lineHeight: 20,
  },
  loadingBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    minHeight: 36,
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
