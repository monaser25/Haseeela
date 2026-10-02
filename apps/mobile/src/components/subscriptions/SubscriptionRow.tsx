import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Subscription, CurrencyCode } from '@haseela/shared';
import { daysUntilDate } from '@haseela/shared';
import { ChevronRight, Repeat } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';

export interface SubscriptionRowProps {
  subscription: Subscription;
  currency: CurrencyCode;
  onPress: (item: Subscription) => void;
  testID?: string;
}

function SubscriptionRowBase({
  subscription,
  currency,
  onPress,
  testID,
}: SubscriptionRowProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const cycle = subscription.billingCycle || subscription.cycle || 'MONTHLY';
  const monthlyEquivalent =
    cycle === 'YEARLY'
      ? subscription.amount / 12
      : cycle === 'QUARTERLY'
      ? subscription.amount / 3
      : subscription.amount;

  const cycleLabel =
    cycle === 'YEARLY'
      ? t('subscriptions.cycle.yearly')
      : cycle === 'QUARTERLY'
      ? t('subscriptions.cycle.quarterly')
      : t('subscriptions.cycle.monthly');

  const isArchived = Boolean(subscription.archivedAt);
  const isInactive = subscription.status === 'INACTIVE';
  const daysUntil = daysUntilDate(subscription.nextBillingDate);
  const isDueSoon =
    !isArchived &&
    subscription.status === 'ACTIVE' &&
    daysUntil !== null &&
    daysUntil >= 0 &&
    daysUntil <= 7;

  const monthlyCostLabel = t('subscriptions.list.perMonth', {
    amount: formatCurrency(monthlyEquivalent, currency),
  });

  const formattedNextDate = subscription.nextBillingDate
    ? formatDate(parseCalendarDate(subscription.nextBillingDate), {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const scheduleSubtitle = `${formatCurrency(subscription.amount, currency)} · ${cycleLabel}${
    formattedNextDate ? ` · ${t('subscriptions.list.next', { date: formattedNextDate })}` : ''
  }`;

  const accessibilityLabel = `${subscription.name}, ${monthlyCostLabel}, ${cycleLabel}, ${scheduleSubtitle}${
    isArchived
      ? `, ${t('subscriptions.badges.archived')}`
      : isInactive
      ? `, ${t('subscriptions.form.statusInactive')}`
      : ''
  }${isDueSoon ? `, ${t('subscriptions.burden.dueSoon')}` : ''}`;

  return (
    <Pressable
      testID={testID ?? `subscription-row-${subscription.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(subscription)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isArchived
              ? theme.colors.surfaceHover
              : theme.colors.accentTint,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Repeat
          size={18}
          color={isArchived ? theme.colors.textMuted : theme.colors.accent}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[theme.typography.bodySemiBold, styles.name, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {subscription.name}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.amount,
              {
                color: isArchived ? theme.colors.textMuted : theme.colors.negative,
              },
            ]}
          >
            {monthlyCostLabel}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.surfaceHover,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: theme.colors.textSecondary,
                },
              ]}
            >
              {cycleLabel}
            </Text>
          </View>

          {isArchived ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.surfaceHover,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: theme.colors.textMuted,
                  },
                ]}
              >
                {t('subscriptions.badges.archived')}
              </Text>
            </View>
          ) : isInactive ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.surfaceHover,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: theme.colors.textMuted,
                  },
                ]}
              >
                {t('subscriptions.form.statusInactive')}
              </Text>
            </View>
          ) : null}

          {isDueSoon && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.warningTint,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: theme.colors.warningText,
                    fontWeight: '600',
                  },
                ]}
              >
                {t('subscriptions.burden.dueSoon')}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[theme.typography.caption, styles.subtitle, { color: theme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {scheduleSubtitle}
        </Text>
      </View>

      <ChevronRight size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export const SubscriptionRow = React.memo(SubscriptionRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
    minHeight: 64,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginEnd: 12,
  },
  content: {
    flex: 1,
    marginEnd: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    marginEnd: 8,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  subtitle: {
    marginTop: 2,
  },
});
