import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Transaction, CurrencyCode } from '@haseela/shared';
import { formatTransactionName } from '@haseela/shared';
import { Receipt } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';

export interface SubscriptionTransactionHistoryProps {
  subscriptionId: string;
  transactions: Transaction[];
  currency: CurrencyCode;
}

export function SubscriptionTransactionHistory({
  subscriptionId,
  transactions,
  currency,
}: SubscriptionTransactionHistoryProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const linkedTransactions = transactions
    .filter(
      (tx) =>
        tx.subscriptionId === subscriptionId ||
        (tx.sourceType === 'subscription' && tx.sourceId === subscriptionId)
    )
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  return (
    <View testID="subscription-transaction-history" style={styles.container}>
      <Text
        style={[
          theme.typography.h3,
          styles.title,
          { color: theme.colors.text },
        ]}
      >
        {t('subscriptions.history.title')}
      </Text>

      {linkedTransactions.length === 0 ? (
        <View
          testID="subscription-history-empty"
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <Receipt size={32} color={theme.colors.textMuted} />
          <Text
            style={[
              theme.typography.body,
              styles.emptyText,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('subscriptions.history.empty')}
          </Text>
        </View>
      ) : (
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
          {linkedTransactions.map((tx, idx) => {
            const formattedDate = formatDate(parseCalendarDate(tx.date), {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <View key={tx.id}>
                {idx > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: theme.colors.border }]}
                  />
                )}
                <View
                  testID={`subscription-tx-${tx.id}`}
                  style={styles.txRow}
                >
                  <View style={styles.txLeft}>
                    <Text
                      style={[
                        theme.typography.bodySemiBold,
                        { color: theme.colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {formatTransactionName(tx.name, t as any)}
                    </Text>
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.textMuted, marginTop: 2 },
                      ]}
                    >
                      {formattedDate}
                    </Text>
                  </View>

                  <Text
                    style={[
                      theme.typography.bodySemiBold,
                      styles.txAmount,
                      {
                        color:
                          tx.type === 'EXPENSE'
                            ? theme.colors.negative
                            : theme.colors.positiveText,
                      },
                    ]}
                  >
                    {tx.type === 'EXPENSE' ? '-' : '+'}
                    {formatCurrency(tx.amount, currency)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  txLeft: {
    flex: 1,
    marginEnd: 12,
  },
  txAmount: {
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
