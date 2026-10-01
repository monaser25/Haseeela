import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import type { Client } from '@haseela/shared';
import { Archive, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface ArchiveClientModalProps {
  visible: boolean;
  client: Client | null;
  transactionCount: number;
  revenueTotal: number;
  currency: string;
  isArchiving: boolean;
  isOnline: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function ArchiveClientModal({
  visible,
  client,
  transactionCount,
  revenueTotal,
  currency,
  isArchiving,
  isOnline,
  error,
  onConfirm,
  onCancel,
  testID = 'archive-client-modal',
}: ArchiveClientModalProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  if (!visible || !client) return null;

  const archiveNotice =
    transactionCount === 1
      ? t('clients.delete.archiveNotice', {
          count: '1',
          amount: formatCurrency(revenueTotal, currency),
        })
      : t('clients.delete.archiveNoticePlural', {
          count: String(transactionCount),
          amount: formatCurrency(revenueTotal, currency),
        });

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
                { backgroundColor: theme.colors.accentTint },
              ]}
            >
              <Archive size={22} color={theme.colors.accent} />
            </View>
            <Text
              style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {t('clients.delete.title', { name: client.name })}
            </Text>
          </View>

          <Text style={[theme.typography.body, styles.description, { color: theme.colors.textSecondary }]}>
            {t('clients.delete.desc')}
          </Text>

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
              <Text style={[theme.typography.small, { color: theme.colors.infoText }]}>
                {archiveNotice}
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
              disabled={isArchiving}
              style={styles.actionBtn}
              testID="archive-modal-cancel"
            >
              {t('clients.delete.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                if (!isOnline || !onlineManager.isOnline() || isArchiving) return;
                onConfirm();
              }}
              loading={isArchiving}
              disabled={!isOnline || !onlineManager.isOnline() || isArchiving}
              style={styles.actionBtn}
              testID="archive-modal-confirm"
            >
              {isArchiving ? t('clients.delete.archiving') : t('clients.actions.archive')}
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
  infoBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
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
