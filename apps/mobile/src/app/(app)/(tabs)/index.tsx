import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  TrendingUp,
  Receipt,
  Wallet,
  Clock,
  RefreshCw,
  Inbox,
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
import { Button, Banner, ScreenContainer } from '../../../components/ui';

export default function HomeScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { t, locale, formatCurrency, formatDate } = useI18n();
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
          {/* Skeleton Header */}
          <View
            style={[
              styles.skeletonBox,
              {
                height: 48,
                width: '60%',
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.md,
              },
            ]}
          />
          {/* Skeleton Hero Card */}
          <View
            style={[
              styles.skeletonBox,
              {
                height: 140,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.lg,
              },
            ]}
          />
          {/* Skeleton Grid */}
          <View style={styles.statsGrid}>
            <View
              style={[
                styles.skeletonBox,
                styles.statCardHalf,
                {
                  height: 100,
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.lg,
                },
              ]}
            />
            <View
              style={[
                styles.skeletonBox,
                styles.statCardHalf,
                {
                  height: 100,
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.lg,
                },
              ]}
            />
          </View>
          {/* Skeleton List Card */}
          <View
            style={[
              styles.skeletonBox,
              {
                height: 180,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.lg,
              },
            ]}
          />
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
            <AlertCircle size={40} color={theme.colors.negative} />
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

  const formattedNetProfit = formatCurrency(stats.netProfit, currency);
  const formattedRevenue = formatCurrency(stats.totalRevenue, currency);
  const formattedExpenses = formatCurrency(stats.totalExpenses, currency);
  const formattedPending = formatCurrency(stats.pendingTotal, currency);

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
        />
      }
    >
      <View style={styles.container}>
        {/* Header Greeting */}
        <View style={styles.header}>
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
          >
            {greeting}
          </Text>
        </View>

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
          />
        ) : null}

        {/* Empty state when user has no data */}
        {isDataEmpty ? (
          <View
            style={[
              styles.card,
              styles.emptyCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.lg,
              },
            ]}
            testID="home-empty-state"
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.colors.surfaceHover },
              ]}
            >
              <Inbox size={40} color={theme.colors.textMuted} />
            </View>
            <Text
              accessibilityRole="header"
              style={[theme.typography.h2, styles.emptyTitle, { color: theme.colors.text }]}
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
          </View>
        ) : (
          <>
            {/* Hero Net Profit Card */}
            <View
              style={[
                styles.card,
                styles.heroCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={`${t('dashboard.stats.netProfit')}, ${formattedNetProfit}`}
              testID="stat-card-net-profit"
            >
              <View style={styles.cardHeaderRow}>
                <Text
                  style={[
                    theme.typography.captionUpper,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {t('dashboard.stats.netProfit')}
                </Text>
                <Wallet size={20} color={theme.colors.accent} />
              </View>
              <Text
                style={[
                  theme.typography.hero,
                  styles.heroAmount,
                  {
                    color:
                      stats.netProfit >= 0
                        ? theme.colors.positiveText
                        : theme.colors.negativeText,
                  },
                ]}
                testID="stat-value-net-profit"
              >
                {formattedNetProfit}
              </Text>
            </View>

            {/* Stat Cards Grid: Revenue, Expenses, Pending */}
            <View style={styles.statsGrid}>
              {/* Revenue */}
              <View
                style={[
                  styles.card,
                  styles.statCardHalf,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`${t('dashboard.stats.totalRevenue')}, ${formattedRevenue}`}
                testID="stat-card-revenue"
              >
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={[
                      theme.typography.captionUpper,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {t('dashboard.stats.totalRevenue')}
                  </Text>
                  <TrendingUp size={18} color={theme.colors.positiveText} />
                </View>
                <Text
                  style={[
                    theme.typography.title,
                    styles.statValue,
                    { color: theme.colors.positiveText },
                  ]}
                  testID="stat-value-revenue"
                >
                  {formattedRevenue}
                </Text>
              </View>

              {/* Expenses */}
              <View
                style={[
                  styles.card,
                  styles.statCardHalf,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`${t('dashboard.stats.totalExpenses')}, ${formattedExpenses}`}
                testID="stat-card-expenses"
              >
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={[
                      theme.typography.captionUpper,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {t('dashboard.stats.totalExpenses')}
                  </Text>
                  <Receipt size={18} color={theme.colors.negativeText} />
                </View>
                <Text
                  style={[
                    theme.typography.title,
                    styles.statValue,
                    { color: theme.colors.negativeText },
                  ]}
                  testID="stat-value-expenses"
                >
                  {formattedExpenses}
                </Text>
              </View>

              {/* Pending */}
              <View
                style={[
                  styles.card,
                  styles.statCardFull,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`${t('pending.kpi.title')}, ${formattedPending}`}
                testID="stat-card-pending"
              >
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={[
                      theme.typography.captionUpper,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {t('pending.kpi.title')}
                  </Text>
                  <Clock size={18} color={theme.colors.warningText} />
                </View>
                <Text
                  style={[
                    theme.typography.title,
                    styles.statValue,
                    { color: theme.colors.warningText },
                  ]}
                  testID="stat-value-pending"
                >
                  {formattedPending}
                </Text>
                {overduePendingCount > 0 ? (
                  <Text
                    style={[
                      theme.typography.smallMedium,
                      { color: theme.colors.negativeText, marginTop: 4 },
                    ]}
                  >
                    {overduePendingCount === 1
                      ? t('pending.kpi.overdue', { count: String(overduePendingCount) })
                      : t('pending.kpi.overduePlural', { count: String(overduePendingCount) })}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Upcoming Subscription Billing */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
              testID="active-subscriptions-card"
            >
              <View style={styles.sectionHeaderRow}>
                <Text
                  accessibilityRole="header"
                  style={[theme.typography.h2, { color: theme.colors.text }]}
                >
                  {t('dashboard.subs.title')}
                </Text>
                <RefreshCw size={18} color={theme.colors.accent} />
              </View>

              {activeSubscriptions.length > 0 ? (
                <View style={styles.subList}>
                  {activeSubscriptions.map((sub) => {
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
                          styles.subRow,
                          { borderBottomColor: theme.colors.border },
                        ]}
                      >
                        <View style={styles.subInfo}>
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
            </View>

            {/* Recent Transactions */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
              testID="recent-transactions-card"
            >
              <View style={styles.sectionHeaderRow}>
                <Text
                  accessibilityRole="header"
                  style={[theme.typography.h2, { color: theme.colors.text }]}
                >
                  {t('dashboard.recent.title')}
                </Text>
              </View>

              {recentTransactions.length > 0 ? (
                <View style={styles.txList}>
                  {recentTransactions.map((tx) => {
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
                          styles.txRow,
                          { borderBottomColor: theme.colors.border },
                        ]}
                      >
                        <View style={styles.txInfo}>
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
            </View>
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
    gap: 2,
    marginBottom: 4,
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  heroCard: {
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroAmount: {
    fontVariant: ['tabular-nums'],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCardHalf: {
    flex: 1,
    minWidth: '45%',
  },
  statCardFull: {
    width: '100%',
  },
  statValue: {
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  subList: {
    gap: 0,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subInfo: {
    flex: 1,
    paddingEnd: 12,
  },
  emptySubText: {
    paddingVertical: 12,
    textAlign: 'center',
  },
  txList: {
    gap: 0,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txInfo: {
    flex: 1,
    paddingEnd: 12,
  },
  skeletonBox: {
    width: '100%',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyActionButton: {
    minWidth: 180,
  },
});
