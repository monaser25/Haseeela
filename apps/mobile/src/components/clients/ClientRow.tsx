import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Client } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';
import { Avatar, Chevron } from '../ui';
import { PressableScale, SwipeableRow } from '../motion';

export interface ClientRowProps {
  client: Client;
  currency: string;
  totalPaid: number;
  onPress: (item: Client) => void;
  onArchive?: (item: Client) => void;
  testID?: string;
}

function ClientRowBase({
  client,
  currency,
  totalPaid,
  onPress,
  onArchive,
  testID,
}: ClientRowProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

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

  const statusColors = {
    ACTIVE: {
      bg: theme.colors.positiveTint,
      text: theme.colors.positiveText,
    },
    PROSPECT: {
      bg: theme.colors.warningTint,
      text: theme.colors.warningText,
    },
    COMPLETED: {
      bg: theme.colors.infoTint,
      text: theme.colors.infoText,
    },
    INACTIVE: {
      bg: theme.colors.surfaceHover,
      text: theme.colors.textMuted,
    },
  }[client.status] || {
    bg: theme.colors.surfaceHover,
    text: theme.colors.textMuted,
  };

  const scheduleText = isRetainer
    ? t('clients.payment.monthlyNext', {
        amount: formatCurrency(client.revenue, currency),
        date: client.nextBillingDate
          ? formatDate(parseCalendarDate(client.nextBillingDate), { month: 'short', day: 'numeric' })
          : t('clients.payment.notScheduled'),
      })
    : t('clients.payment.onetime', {
        amount: formatCurrency(client.revenue, currency),
        date: client.paymentDate
          ? formatDate(parseCalendarDate(client.paymentDate), { month: 'short', day: 'numeric' })
          : t('clients.payment.notScheduled'),
      });

  const accessibilityLabel = `${client.name}, ${client.company ? `${client.company}, ` : ''}${statusLabel}, ${
    isRetainer ? t('clients.badges.retainer') : t('clients.badges.onetime')
  }, ${scheduleText}, ${t('clients.payment.totalPaid')}: ${formatCurrency(totalPaid, currency)}`;

  const rowContent = (
    <PressableScale
      testID={testID ?? `client-row-${client.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(client)}
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
      <Avatar name={client.name} size={48} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[theme.typography.bodySemiBold, styles.name, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {client.name}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.totalPaid,
              { color: totalPaid > 0 ? theme.colors.positiveText : theme.colors.textMuted },
            ]}
          >
            {formatCurrency(totalPaid, currency)}
          </Text>
        </View>

        {Boolean(client.company) && (
          <Text
            style={[theme.typography.small, styles.company, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {client.company}
          </Text>
        )}

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
                {
                  color: isRetainer ? theme.colors.accentText : theme.colors.textSecondary,
                },
              ]}
            >
              {isRetainer ? t('clients.badges.retainer') : t('clients.badges.onetime')}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.badgeText, { color: statusColors.text }]}>
              {statusLabel}
            </Text>
          </View>

          {isArchived && (
            <View style={[styles.badge, { backgroundColor: theme.colors.surfaceHover }]}>
              <Text style={[styles.badgeText, { color: theme.colors.textMuted }]}>
                {t('clients.badges.archived')}
              </Text>
            </View>
          )}

          <Text
            style={[theme.typography.caption, styles.scheduleText, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            {scheduleText}
          </Text>
        </View>
      </View>

      <Chevron size={18} color={theme.colors.textMuted} />
    </PressableScale>
  );

  return (
    <SwipeableRow
      enabled={Boolean(onArchive && !isArchived)}
      action={
        onArchive
          ? {
              type: 'archive',
              label: t('clients.actions.archive'),
              isDestructive: false,
              confirmTitle: t('clients.delete.title', { name: client.name }),
              confirmMessage: t('clients.delete.desc'),
              confirmText: t('clients.actions.archive'),
              cancelText: t('clients.delete.cancel'),
              onPress: () => onArchive(client),
              testID: `client-archive-${client.id}`,
            }
          : undefined
      }
      style={styles.swipeWrapper}
    >
      {rowContent}
    </SwipeableRow>
  );
}

export const ClientRow = React.memo(ClientRowBase);

const styles = StyleSheet.create({
  swipeWrapper: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76, // Exceeds 44pt touch target
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
  },
  totalPaid: {
    fontVariant: ['tabular-nums'],
  },
  company: {
    marginTop: -1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleText: {
    marginStart: 2,
  },
});
