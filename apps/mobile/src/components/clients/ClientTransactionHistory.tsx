import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Client, Transaction } from '@haseela/shared';
import { formatTransactionName, prefixCurrencySign } from '@haseela/shared';
import { History } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';

export interface ClientTransactionHistoryProps {
  client: Client;
  transactions: Transaction[];
  currency: string;
}

export function ClientTransactionHistory({
  client,
  transactions,
  currency,
}: ClientTransactionHistoryProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const isRetainer = client.paymentType === 'retainer';

  return (
    <View
      style={[
        styles.historyCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.historyHeader}>
        <View style={styles.historyTitleRow}>
          <History size={18} color={theme.colors.textSecondary} />
          <Text
            accessibilityRole="header"
            style={[theme.typography.h3, { color: theme.colors.text }]}
          >
            {t('clients.history.title')}
          </Text>
        </View>
        {isRetainer && (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {t('clients.history.nextBilling', {
              date: client.nextBillingDate
                ? formatDate(parseCalendarDate(client.nextBillingDate), { month: 'short', day: 'numeric' })
                : t('clients.payment.notScheduled'),
            })}
          </Text>
        )}
      </View>

      {transactions.length === 0 ? (
        <View style={styles.historyEmpty} testID="client-tx-history-empty">
          <Text style={[theme.typography.body, { color: theme.colors.textMuted }]}>
            {t('clients.history.empty')}
          </Text>
        </View>
      ) : (
        <View style={styles.txList} testID="client-tx-history">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'INCOME';
            const isCompleted = tx.status === 'COMPLETED';
            const rawName = tx.name || tx.notes || t('clients.history.paymentFallback');
            const displayName = formatTransactionName(rawName, t as any);
            const txDateStr = tx.status === 'PENDING' && tx.expectedDate ? tx.expectedDate : tx.date;
            const txStatusLabel = isCompleted
              ? t('transactions.status.completed')
              : t('transactions.status.pending');

            return (
              <View
                key={tx.id}
                style={[
                  styles.txRow,
                  { borderBottomColor: theme.colors.border },
                ]}
                testID={`client-tx-${tx.id}`}
              >
                <View style={styles.txLeft}>
                  <Text
                    style={[
                      theme.typography.bodySemiBold,
                      { color: theme.colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {formatDate(parseCalendarDate(txDateStr), { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                <View style={styles.txRight}>
                  <Text
                    style={[
                      theme.typography.bodySemiBold,
                      styles.txAmount,
                      {
                        color: isIncome
                          ? theme.colors.positiveText
                          : theme.colors.negativeText,
                      },
                    ]}
                  >
                    {prefixCurrencySign(isIncome ? '+' : '-', formatCurrency(tx.amount, currency))}
                  </Text>
                  <View
                    style={[
                      styles.txBadge,
                      {
                        backgroundColor: isCompleted
                          ? theme.colors.positiveTint
                          : theme.colors.warningTint,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.txBadgeText,
                        {
                          color: isCompleted
                            ? theme.colors.positiveText
                            : theme.colors.warningText,
                        },
                      ]}
                    >
                      {txStatusLabel}
                    </Text>
                  </View>
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
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyEmpty: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txList: {
    gap: 0,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  txLeft: {
    flex: 1,
    gap: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontVariant: ['tabular-nums'],
  },
  txBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
