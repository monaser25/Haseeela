import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Client } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface ClientDetailOverviewProps {
  client: Client;
  totalPaid: number;
  currency: string;
}

export function ClientDetailOverview({
  client,
  totalPaid,
  currency,
}: ClientDetailOverviewProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  const isRetainer = client.paymentType === 'retainer';
  const isArchived = Boolean(client.archivedAt);

  const statusLabel =
    client.status === 'ACTIVE'
      ? t('clients.form.statusActive')
      : client.status === 'PROSPECT'
      ? t('clients.form.statusProspect')
      : client.status === 'COMPLETED'
      ? t('clients.form.statusCompleted')
      : t('clients.form.statusInactive');

  return (
    <View
      style={[
        styles.overviewCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.overviewTop}>
        <View style={styles.nameSection}>
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>
            {client.name}
          </Text>
          {Boolean(client.company) && (
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {client.company}
            </Text>
          )}
          {Boolean(client.email) && (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              {client.email}
            </Text>
          )}
        </View>

        <View style={styles.paidBadge}>
          <Text style={[theme.typography.captionUpper, { color: theme.colors.textMuted }]}>
            {t('clients.payment.totalPaid')}
          </Text>
          <Text
            style={[
              theme.typography.h2,
              styles.paidAmount,
              { color: totalPaid > 0 ? theme.colors.positiveText : theme.colors.text },
            ]}
          >
            {formatCurrency(totalPaid, currency)}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isRetainer ? theme.colors.accentTint : theme.colors.surfaceHover,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isRetainer ? theme.colors.accent : theme.colors.textSecondary },
            ]}
          >
            {isRetainer ? t('clients.badges.retainer') : t('clients.badges.onetime')}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                client.status === 'ACTIVE'
                  ? theme.colors.positiveTint
                  : theme.colors.surfaceHover,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color:
                  client.status === 'ACTIVE'
                    ? theme.colors.positiveText
                    : theme.colors.textMuted,
              },
            ]}
          >
            {statusLabel}
          </Text>
        </View>

        {isArchived && (
          <View style={[styles.badge, { backgroundColor: theme.colors.warningTint }]}>
            <Text style={[styles.badgeText, { color: theme.colors.warningText }]}>
              {t('clients.badges.archived')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  overviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nameSection: {
    flex: 1,
    gap: 4,
  },
  paidBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  paidAmount: {
    fontVariant: ['tabular-nums'],
  },
  badgeRow: {
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
    fontWeight: '600',
  },
});
