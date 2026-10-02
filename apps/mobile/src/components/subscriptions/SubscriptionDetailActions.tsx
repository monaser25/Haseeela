import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { Subscription } from '@haseela/shared';
import { CreditCard, Archive, RotateCcw, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../ui';

export interface SubscriptionDetailActionsProps {
  subscription: Subscription;
  isOnline: boolean;
  isRestoring?: boolean;
  isBusy?: boolean;
  onRecordPayment: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDeletePermanent: () => void;
}

export function SubscriptionDetailActions({
  subscription,
  isOnline,
  isRestoring = false,
  isBusy = false,
  onRecordPayment,
  onArchive,
  onRestore,
  onDeletePermanent,
}: SubscriptionDetailActionsProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const isArchived = Boolean(subscription.archivedAt);
  const isActive = subscription.status === 'ACTIVE' && !isArchived;

  return (
    <View style={styles.container}>
      {isActive && (
        <Button
          testID="subscription-record-payment-btn"
          variant="primary"
          onPress={onRecordPayment}
          disabled={!isOnline || isBusy}
          icon="creditCard"
          style={styles.button}
        >
          {t('subscriptions.recordPayment.confirm')}
        </Button>
      )}

      {!isArchived ? (
        <Button
          testID="subscription-archive-btn"
          variant="secondary"
          onPress={onArchive}
          disabled={!isOnline || isBusy}
          icon="archive"
          style={styles.button}
        >
          {t('subscriptions.actions.archive')}
        </Button>
      ) : (
        <>
          <Button
            testID="subscription-restore-btn"
            variant="secondary"
            onPress={onRestore}
            loading={isRestoring}
            disabled={!isOnline || isBusy}
            icon="rotateCcw"
            style={styles.button}
          >
            {t('subscriptions.actions.restore')}
          </Button>

          <Button
            testID="subscription-delete-permanent-btn"
            variant="primary"
            onPress={onDeletePermanent}
            disabled={!isOnline || isBusy}
            icon="trash"
            style={[styles.button, { backgroundColor: theme.colors.negative }]}
          >
            {t('subscriptions.actions.deletePermanently')}
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 20,
  },
  button: {
    width: '100%',
  },
});
