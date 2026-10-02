import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { Client } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface ClientDetailActionsProps {
  client: Client;
  isOnline: boolean;
  canRecordRetainer: boolean;
  isArchived: boolean;
  isRecording: boolean;
  isAddingPending: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
  isDeletingPermanent: boolean;
  onRecordPayment: () => void;
  onAddPending: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDeletePermanent: () => void;
}

export function ClientDetailActions({
  isOnline,
  canRecordRetainer,
  isArchived,
  isRecording,
  isAddingPending,
  isArchiving,
  isRestoring,
  isDeletingPermanent,
  onRecordPayment,
  onAddPending,
  onArchive,
  onRestore,
  onDeletePermanent,
}: ClientDetailActionsProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.actionButtonsRow}>
      {canRecordRetainer && (
        <Button
          variant="primary"
          onPress={onRecordPayment}
          disabled={!isOnline || isRecording}
          style={styles.actionButton}
          testID="client-record-payment-btn"
        >
          {t('clients.recordPayment.title')}
        </Button>
      )}

      {!isArchived && (
        <Button
          variant="secondary"
          onPress={onAddPending}
          disabled={!isOnline || isAddingPending}
          style={styles.actionButton}
          testID="client-add-pending-btn"
        >
          {t('clients.actions.addPending')}
        </Button>
      )}

      {!isArchived ? (
        <Button
          variant="secondary"
          onPress={onArchive}
          disabled={!isOnline || isArchiving}
          style={styles.actionButton}
          testID="client-archive-btn"
        >
          {t('clients.actions.archive')}
        </Button>
      ) : (
        <Button
          variant="primary"
          onPress={onRestore}
          loading={isRestoring}
          disabled={!isOnline || isRestoring}
          style={styles.actionButton}
          testID="client-restore-btn"
        >
          {t('clients.actions.restore')}
        </Button>
      )}

      {isArchived && (
        <Button
          variant="primary"
          onPress={onDeletePermanent}
          disabled={!isOnline || isDeletingPermanent}
          style={[styles.actionButton, { backgroundColor: theme.colors.negative }]}
          testID="client-delete-permanent-btn"
        >
          {t('clients.delete.deletePermanently')}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    minHeight: 44, // 44pt touch target
  },
});
