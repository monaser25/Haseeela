import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Subscription, CurrencyCode } from '@haseela/shared';
import { daysUntilDate } from '@haseela/shared';
import { Repeat } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';
import { Chevron, IconTile } from '../ui';
import { PressableScale } from '../motion';

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
    <PressableScale
      testID={testID ?? `subscription-row-${subscription.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(subscription)}
      scaleTo={theme.motion.press.scaleCard}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.xl,
        },
        theme.shadows.sm,
      ]}
    >
      <IconTile icon={Repeat} tone={isArchived ? 'neutral' : 'accent'} size={44} />

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
                color: isArchived ? theme.colors.textMuted : theme.colors.negativeText,
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

      <Chevron size={18} color={theme.colors.textMuted} />
    </PressableScale>
  );
}

export const SubscriptionRow = React.memo(SubscriptionRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    minHeight: 72,
  },
  content: {
    flex: 1,
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
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  subtitle: {
    marginTop: 2,
  },
});
