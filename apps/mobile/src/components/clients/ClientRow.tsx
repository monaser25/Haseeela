import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Client } from '@haseela/shared';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';

export interface ClientRowProps {
  client: Client;
  currency: string;
  totalPaid: number;
  onPress: (item: Client) => void;
  testID?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ClientRowBase({
  client,
  currency,
  totalPaid,
  onPress,
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

  return (
    <Pressable
      testID={testID ?? `client-row-${client.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(client)}
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
          styles.avatar,
          {
            backgroundColor: theme.colors.accentTint,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.avatarText, { color: theme.colors.accent }]}>
          {getInitials(client.name)}
        </Text>
      </View>

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
                  color: isRetainer ? theme.colors.accent : theme.colors.textSecondary,
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

      <View style={styles.chevronContainer}>
        <ChevronRight size={18} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

export const ClientRow = React.memo(ClientRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72, // Exceeds 44pt touch target
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleText: {
    marginLeft: 2,
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
});
