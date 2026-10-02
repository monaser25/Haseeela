import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Clock,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from 'lucide-react-native';
import {
  getOverviewStats,
  selectOverduePendingCount,
  getRecentTransactions,
  categoryLabel,
  computeNextBillingDate,
} from '@haseela/shared';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useAuth } from '../../../auth';
import { useOverview, usePreferences } from '../../../api';
import {
  Avatar,
  Banner,
  Button,
  Card,
  IconTile,
  ScreenContainer,
  SectionHeader,
} from '../../../components/ui';
import { AnimatedNumber, FadeInView, Skeleton } from '../../../components/motion';

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();
  const { user } = useAuth();

  const {
    data: overview,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOverview();

  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';

  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, currency),
    [formatCurrency, currency]
  );

  const transactions = useMemo(() => overview?.transactions ?? [], [overview]);
  const clients = useMemo(() => overview?.clients ?? [], [overview]);
  const subscriptions = useMemo(() => overview?.subscriptions ?? [], [overview]);

  const stats = useMemo(
    () => getOverviewStats(transactions, clients, subscriptions),
    [transactions, clients, subscriptions]
  );

  const overduePendingCount = useMemo(
    () => selectOverduePendingCount(transactions),
    [transactions]
  );

  const recentTransactions = useMemo(
    () => getRecentTransactions(transactions, 5),
    [transactions]
  );

  const activeSubscriptions = useMemo(
    () =>
      subscriptions
        .filter((s) => s.status === 'ACTIVE' && !s.archivedAt)
        .sort((a, b) => {
          const dateA = a.nextBillingDate || computeNextBillingDate(a.billingDay || 1);
          const dateB = b.nextBillingDate || computeNextBillingDate(b.billingDay || 1);
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        })
        .slice(0, 4),
    [subscriptions]
  );

  const displayName =
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    t('onboarding.welcome.fallback_name');

  const greeting = t('onboarding.welcome.title', { name: displayName });

  const isDataEmpty =
    transactions.length === 0 &&
    clients.length === 0 &&
    subscriptions.length === 0;

  function getRelativeDate(isoDate: string) {
    const txDate = new Date(isoDate);
    const diff = Date.now() - txDate.getTime();
    if (diff < 0) return formatDate(txDate, { month: 'short', day: 'numeric' });
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return t('dashboard.relativeDate.today');
    if (days === 1) return t('dashboard.relativeDate.yesterday');
    if (days < 7) return t('dashboard.relativeDate.daysAgo', { days: String(days) });
    return formatDate(txDate, { month: 'short', day: 'numeric' });
  }

  // Loading skeleton state
  if (isLoading && !overview) {
    return (
      <ScreenContainer
        testID="home-loading-skeleton"
        edges={['top', 'left', 'right']}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Skeleton width="30%" height={14} />
            <Skeleton width="62%" height={26} />
          </View>
          <Skeleton height={148} radius={theme.radius.xl} />
          <View style={styles.statsRow}>
            <Skeleton height={112} radius={theme.radius.xl} style={styles.flexItem} />
            <Skeleton height={112} radius={theme.radius.xl} style={styles.flexItem} />
          </View>
          <Skeleton height={96} radius={theme.radius.xl} />
          <Skeleton height={190} radius={theme.radius.xl} />
        </View>
      </ScreenContainer>
    );
  }

  // Error state with retry
  if (isError && !overview) {
    return (
      <ScreenContainer
        testID="home-error-state"
        edges={['top', 'left', 'right']}
      >
        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorIconCircle,
              {
                backgroundColor: theme.colors.negativeTint,
              },
            ]}
          >
            <AlertCircle size={40} color={theme.colors.negativeText} />
          </View>
          <Text
            accessibilityRole="header"
            style={[theme.typography.title, styles.errorTitle, { color: theme.colors.text }]}
          >
            {t('dashboard.alert.syncIssue')}
          </Text>
          <Text
            style={[theme.typography.body, styles.errorMessage, { color: theme.colors.textSecondary }]}
          >
            {error?.message || t('dashboard.error.load')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            testID="retry-button"
            style={styles.retryButton}
          >
            {t('offline.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  const formattedNetProfit = formatMoney(stats.netProfit);
  const formattedRevenue = formatMoney(stats.totalRevenue);
  const formattedExpenses = formatMoney(stats.totalExpenses);
  const formattedPending = formatMoney(stats.pendingTotal);

  return (
    <ScreenContainer
      testID="home-screen"
      edges={['top', 'left', 'right']}
      refreshControl={
        <RefreshControl
          refreshing={Boolean(isRefetching)}
          onRefresh={refetch}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      <View style={styles.container}>
        {/* Header Greeting */}
        <FadeInView index={0} style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text
              style={[
                theme.typography.captionUpper,
                { color: theme.colors.textMuted },
              ]}
            >
              {t('brand.name')}
            </Text>
            <Text
              accessibilityRole="header"
              style={[theme.typography.h1, { color: theme.colors.text }]}
              testID="home-greeting"
              numberOfLines={2}
            >
              {greeting}
            </Text>
          </View>
          <Avatar name={displayName} size={44} />
        </FadeInView>

        {/* Overdue Pending Alert */}
        {overduePendingCount > 0 ? (
          <Banner
            tone="warning"
            title={t('invoices.status.overdue')}
            message={
              overduePendingCount === 1
                ? t('dashboard.alert.overdue', { count: String(overduePendingCount) })
                : t('dashboard.alert.overduePlural', { count: String(overduePendingCount) })
            }
            testID="overdue-pending-alert"
            style={styles.banner}
          />
        ) : null}

        {/* Empty state when user has no data */}
        {isDataEmpty ? (
          <FadeInView index={1}>
            <Card variant="tinted" padding={28} style={styles.emptyCard} testID="home-empty-state">
              <View style={[styles.emptyIconRing, { backgroundColor: theme.colors.surface }, theme.shadows.sm]}>
                <IconTile icon={Sparkles} tone="accent" size={56} />
              </View>
              <Text
                accessibilityRole="header"
                style={[theme.typography.h1, styles.emptyTitle, { color: theme.colors.text }]}
              >
                {t('dashboard.recent.empty')}
              </Text>
              <Text
                style={[
                  theme.typography.body,
                  styles.emptySubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {t('dashboard.recent.emptyAction')}
              </Text>
              <Button
                variant="primary"
                onPress={() => router.push('/clients')}
                style={styles.emptyActionButton}
                testID="empty-action-button"
              >
                {t('dashboard.actions.addClient')}
              </Button>
            </Card>
          </FadeInView>
        ) : (
          <>
            {/* Hero Net Profit Card */}
            <FadeInView index={1}>
              <Card
                variant="gradient"
                padding={24}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`${t('dashboard.stats.netProfit')}, ${formattedNetProfit}`}
                testID="stat-card-net-profit"
              >
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={[
                      theme.typography.smallMedium,
                      { color: theme.colors.onHeroMuted },
                    ]}
                  >
                    {t('dashboard.stats.netProfit')}
                  </Text>
                  <View style={[styles.heroChip, { backgroundColor: theme.colors.onHeroSurface }]}>
                    <Wallet size={18} color={theme.colors.onHero} />
                  </View>
                </View>
                <AnimatedNumber
                  value={stats.netProfit}
                  format={formatMoney}
                  style={[
                    theme.typography.display,
                    styles.tabular,
                    { color: theme.colors.onHero },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="stat-value-net-profit"
                />
              </Card>
            </FadeInView>

            {/* Stat Cards: Revenue, Expenses */}
            <View style={styles.statsRow}>
              <FadeInView index={2} style={styles.flexItem}>
                <Card
                  accessible={true}
                  accessibilityRole="text"
                  accessibilityLabel={`${t('dashboard.stats.totalRevenue')}, ${formattedRevenue}`}
                  testID="stat-card-revenue"
                  padding={16}
                  style={styles.statCard}
                >
                  <IconTile icon={TrendingUp} tone="positive" size={36} />
                  <Text
                    style={[
                      theme.typography.small,
                      styles.statLabel,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {t('dashboard.stats.totalRevenue')}
                  </Text>
                  <AnimatedNumber
                    value={stats.totalRevenue}
                    format={formatMoney}
                    style={[
                      theme.typography.amount,
                      styles.tabular,
                      { color: theme.colors.positiveText },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    testID="stat-value-revenue"
                  />
                </Card>
              </FadeInView>

              <FadeInView index={3} style={styles.flexItem}>
                <Card
                  accessible={true}
                  accessibilityRole="text"
                  accessibilityLabel={`${t('dashboard.stats.totalExpenses')}, ${formattedExpenses}`}
                  testID="stat-card-expenses"
                  padding={16}
                  style={styles.statCard}
                >
                  <IconTile icon={Receipt} tone="negative" size={36} />
                  <Text
                    style={[
                      theme.typography.small,
                      styles.statLabel,
                      { color: theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {t('dashboard.stats.totalExpenses')}
                  </Text>
                  <AnimatedNumber
                    value={stats.totalExpenses}
                    format={formatMoney}
                    style={[
                      theme.typography.amount,
                      styles.tabular,
                      { color: theme.colors.negativeText },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    testID="stat-value-expenses"
                  />
                </Card>
              </FadeInView>
            </View>

            {/* Pending */}
            <FadeInView index={4}>
              <Card
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`${t('pending.kpi.title')}, ${formattedPending}`}
                testID="stat-card-pending"
                padding={16}
              >
                <View style={styles.pendingRow}>
                  <IconTile icon={Clock} tone="warning" size={44} />
                  <View style={styles.pendingText}>
                    <Text
                      style={[theme.typography.small, { color: theme.colors.textSecondary }]}
                    >
                      {t('pending.kpi.title')}
                    </Text>
                    <AnimatedNumber
                      value={stats.pendingTotal}
                      format={formatMoney}
                      style={[
                        theme.typography.amount,
                        styles.tabular,
                        { color: theme.colors.warningText },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      testID="stat-value-pending"
                    />
                    {overduePendingCount > 0 ? (
                      <Text
                        style={[
                          theme.typography.smallMedium,
                          { color: theme.colors.negativeText, marginTop: 2 },
                        ]}
                      >
                        {overduePendingCount === 1
                          ? t('pending.kpi.overdue', { count: String(overduePendingCount) })
                          : t('pending.kpi.overduePlural', { count: String(overduePendingCount) })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            </FadeInView>

            {/* Upcoming Subscription Billing */}
            <FadeInView index={5}>
              <Card testID="active-subscriptions-card" padding={20}>
                <SectionHeader
                  title={t('dashboard.subs.title')}
                  trailing={<RefreshCw size={18} color={theme.colors.accentText} />}
                />

                {activeSubscriptions.length > 0 ? (
                  <View>
                    {activeSubscriptions.map((sub, index) => {
                      const nextDate =
                        sub.nextBillingDate ||
                        computeNextBillingDate(sub.billingDay || 1);
                      const formattedDate = formatDate(nextDate, {
                        month: 'short',
                        day: 'numeric',
                      });
                      const renewsLabel = t('dashboard.subs.renews', {
                        date: formattedDate,
                      });
                      const cycleSuffix =
                        sub.cycle === 'YEARLY'
                          ? t('dashboard.subs.perYear')
                          : t('dashboard.subs.perMonth');

                      return (
                        <View
                          key={sub.id}
                          style={[
                            styles.listRow,
                            index > 0 && {
                              borderTopColor: theme.colors.border,
                              borderTopWidth: StyleSheet.hairlineWidth,
                            },
                          ]}
                        >
                          <IconTile icon={RefreshCw} tone="accent" size={40} />
                          <View style={styles.listInfo}>
                            <Text
                              style={[
                                theme.typography.bodyMedium,
                                { color: theme.colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {sub.name}
                            </Text>
                            <Text
                              style={[
                                theme.typography.small,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {renewsLabel}
                            </Text>
                          </View>
                          <Text
                            style={[
                              theme.typography.bodySemiBold,
                              styles.tabular,
                              { color: theme.colors.text },
                            ]}
                          >
                            {formatCurrency(sub.amount, currency)}
                            <Text
                              style={[
                                theme.typography.small,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {cycleSuffix}
                            </Text>
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text
                    style={[
                      theme.typography.body,
                      styles.emptySubText,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {t('dashboard.subs.empty')}
                  </Text>
                )}
              </Card>
            </FadeInView>

            {/* Recent Transactions */}
            <FadeInView index={6}>
              <Card testID="recent-transactions-card" padding={20}>
                <SectionHeader title={t('dashboard.recent.title')} />

                {recentTransactions.length > 0 ? (
                  <View>
                    {recentTransactions.map((tx, index) => {
                      const isIncome = tx.type === 'INCOME';
                      const sign = isIncome ? '+' : '−';
                      const amountTone = isIncome
                        ? theme.colors.positiveText
                        : theme.colors.negativeText;
                      const cat = categoryLabel(tx.categoryId || tx.type, (k) => t(k));
                      const relDate = getRelativeDate(tx.date);

                      return (
                        <View
                          key={tx.id}
                          style={[
                            styles.listRow,
                            index > 0 && {
                              borderTopColor: theme.colors.border,
                              borderTopWidth: StyleSheet.hairlineWidth,
                            },
                          ]}
                        >
                          <IconTile
                            icon={isIncome ? TrendingUp : TrendingDown}
                            tone={isIncome ? 'positive' : 'negative'}
                            size={40}
                          />
                          <View style={styles.listInfo}>
                            <Text
                              style={[
                                theme.typography.bodyMedium,
                                { color: theme.colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {tx.name}
                            </Text>
                            <Text
                              style={[
                                theme.typography.small,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {cat} · {relDate}
                            </Text>
                          </View>
                          <Text
                            style={[
                              theme.typography.bodySemiBold,
                              styles.tabular,
                              { color: amountTone },
                            ]}
                          >
                            {sign}
                            {formatCurrency(tx.amount, currency)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text
                    style={[
                      theme.typography.body,
                      styles.emptySubText,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {t('dashboard.recent.empty')}
                  </Text>
                )}
              </Card>
            </FadeInView>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    width: '100%',
  },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  banner: {
    marginBottom: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexItem: {
    flex: 1,
  },
  statCard: {
    gap: 4,
  },
  statLabel: {
    marginTop: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pendingText: {
    flex: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  listInfo: {
    flex: 1,
  },
  emptySubText: {
    paddingVertical: 12,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorMessage: {
    textAlign: 'center',
    maxWidth: 320,
  },
  retryButton: {
    marginTop: 8,
    minWidth: 160,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
  },
  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyActionButton: {
    minWidth: 200,
  },
});
