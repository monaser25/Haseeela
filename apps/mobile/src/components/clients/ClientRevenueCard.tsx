import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign, Users, Repeat } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface ClientRevenueCardProps {
  totalRevenue: number;
  activeCount: number;
  retainerCount: number;
  archivedCount: number;
  currency: string;
  topClientName?: string;
  topClientRevenue?: number;
  testID?: string;
}

export function ClientRevenueCard({
  totalRevenue,
  activeCount,
  retainerCount,
  archivedCount,
  currency,
  topClientName,
  topClientRevenue,
  testID = 'client-revenue-card',
}: ClientRevenueCardProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text
            style={[
              theme.typography.captionUpper,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('clients.revenue.title')}
          </Text>
          <Text
            style={[
              theme.typography.h1,
              styles.totalRevenue,
              { color: totalRevenue > 0 ? theme.colors.positiveText : theme.colors.text },
            ]}
          >
            {formatCurrency(totalRevenue, currency)}
          </Text>
        </View>

        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: theme.colors.accentTint,
            },
          ]}
        >
          <DollarSign size={22} color={theme.colors.accent} />
        </View>
      </View>

      {Boolean(topClientName && topClientRevenue && topClientRevenue > 0) && (
        <View
          style={[
            styles.topClientBox,
            {
              backgroundColor: theme.colors.surfaceHover,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text
            style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {t('clients.top.title')}:{' '}
            <Text style={{ fontWeight: '700', color: theme.colors.text }}>
              {topClientName}
            </Text>{' '}
            ({formatCurrency(topClientRevenue ?? 0, currency)})
          </Text>
        </View>
      )}

      <View
        style={[
          styles.statsRow,
          {
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.statCol}>
          <Text
            style={[theme.typography.caption, { color: theme.colors.textMuted }]}
          >
            {t('clients.stats.active')}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.statValue,
              { color: theme.colors.text },
            ]}
          >
            {activeCount}
          </Text>
        </View>

        <View
          style={[styles.statDivider, { backgroundColor: theme.colors.border }]}
        />

        <View style={styles.statCol}>
          <Text
            style={[theme.typography.caption, { color: theme.colors.textMuted }]}
          >
            {t('clients.stats.retainers')}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.statValue,
              { color: theme.colors.accent },
            ]}
          >
            {retainerCount}
          </Text>
        </View>

        {archivedCount > 0 && (
          <>
            <View
              style={[
                styles.statDivider,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <View style={styles.statCol}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textMuted },
                ]}
              >
                {t('clients.stats.archived')}
              </Text>
              <Text
                style={[
                  theme.typography.bodySemiBold,
                  styles.statValue,
                  { color: theme.colors.textMuted },
                ]}
              >
                {archivedCount}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleCol: {
    gap: 4,
  },
  totalRevenue: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topClientBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
});
