import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Subscription, CurrencyCode } from '@haseela/shared';
import { daysUntilDate } from '@haseela/shared';
import { Calendar, Repeat, FileText, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';

export interface SubscriptionDetailOverviewProps {
  subscription: Subscription;
  currency: CurrencyCode;
}

export function SubscriptionDetailOverview({
  subscription,
  currency,
}: SubscriptionDetailOverviewProps) {
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

  const formattedNextDate = subscription.nextBillingDate
    ? formatDate(parseCalendarDate(subscription.nextBillingDate), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <View style={styles.container}>
      {/* Top Card: Monthly Burden & Cycle */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isArchived
              ? theme.colors.surface
              : theme.colors.negativeTint,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <Text
          style={[
            styles.caption,
            {
              color: isArchived ? theme.colors.textMuted : theme.colors.negative,
            },
          ]}
        >
          {t('subscriptions.detail.monthlyEquivalent', {
            amount: formatCurrency(monthlyEquivalent, currency),
          })}
        </Text>

        <Text
          testID="subscription-detail-amount"
          style={[
            styles.largeAmount,
            {
              color: isArchived ? theme.colors.textSecondary : theme.colors.negative,
            },
          ]}
        >
          {formatCurrency(subscription.amount, currency)}
        </Text>

        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.textSecondary,
              marginBottom: 10,
            },
          ]}
        >
          {t('subscriptions.detail.actualCycle', {
            amount: formatCurrency(subscription.amount, currency),
            cycle: cycleLabel,
          })}
        </Text>

        <View style={styles.badgesRow}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
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
              <Text style={[styles.badgeText, { color: theme.colors.textMuted }]}>
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
              <Text style={[styles.badgeText, { color: theme.colors.textMuted }]}>
                {t('subscriptions.form.statusInactive')}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.positiveTint,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.colors.positiveText }]}>
                {t('subscriptions.form.statusActive')}
              </Text>
            </View>
          )}

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
      </View>

      {/* Schedule Info Card */}
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
        <View style={styles.infoRow}>
          <Calendar size={18} color={theme.colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {t('subscriptions.form.nextBillingLabel')}
            </Text>
            <Text
              testID="subscription-detail-next-date"
              style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}
            >
              {formattedNextDate || '—'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.infoRow}>
          <Repeat size={18} color={theme.colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {t('subscriptions.form.billingDayLabel')}
            </Text>
            <Text
              testID="subscription-detail-billing-day"
              style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}
            >
              {subscription.billingDay}
            </Text>
          </View>
        </View>

        {Boolean(subscription.notes) && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.infoRow}>
              <FileText size={18} color={theme.colors.textSecondary} />
              <View style={styles.infoTextContainer}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  {t('subscriptions.form.notesLabel')}
                </Text>
                <Text
                  testID="subscription-detail-notes"
                  style={[theme.typography.body, { color: theme.colors.text }]}
                >
                  {subscription.notes}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  largeAmount: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
});
