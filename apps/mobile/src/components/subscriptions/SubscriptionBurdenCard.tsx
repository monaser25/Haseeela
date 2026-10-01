import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CurrencyCode } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface SubscriptionBurdenCardProps {
  burden: number;
  activeCount: number;
  dueSoonCount: number;
  currency: CurrencyCode;
}

export function SubscriptionBurdenCard({
  burden,
  activeCount,
  dueSoonCount,
  currency,
}: SubscriptionBurdenCardProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  return (
    <View
      testID="subscriptions-burden-card"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.negativeTint,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.negative,
          },
        ]}
      >
        {t('subscriptions.burden.title')}
      </Text>

      <Text
        testID="subscriptions-burden-amount"
        style={[
          styles.amount,
          {
            color: theme.colors.negative,
          },
        ]}
      >
        {formatCurrency(burden, currency)}
      </Text>

      <View style={styles.footer}>
        <Text
          testID="subscriptions-burden-stats"
          style={[
            theme.typography.caption,
            {
              color: theme.colors.textSecondary,
            },
          ]}
        >
          {t('subscriptions.burden.activeDue', {
            active: activeCount,
            dueSoon: dueSoonCount,
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
