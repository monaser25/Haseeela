import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
  RefreshControl,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Transaction } from '@haseela/shared';
import {
  Search,
  X,
  AlertCircle,
  Receipt,
} from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useOverview, usePreferences, useCompletePendingPayment, useRevertPendingPayment, useDeleteTransaction } from '../../../api';
import { useIsOnline } from '../../../query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import { closeOpenSwipeables } from '../../../components/motion';
import { TransactionRow } from '../../../components/transactions/TransactionRow';
import { CompletePendingModal } from '../../../components/transactions/CompletePendingModal';
import { RevertPendingModal } from '../../../components/transactions/RevertPendingModal';
import { formatCalendarDate, parseCalendarDate } from '../../../utils/calendarDate';

type FilterType = 'all' | 'income' | 'expense' | 'pending';

interface TransactionSection {
  title: string;
  dateKey: string;
  totalAmount: number;
  data: Transaction[];
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, locale, formatCurrency, formatDate } = useI18n();
  const isOnline = useIsOnline();

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

  const completeMutation = useCompletePendingPayment();
  const revertMutation = useRevertPendingPayment();
  const deleteMutation = useDeleteTransaction();

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);

  // Modals for pending actions
  const [completeTarget, setCompleteTarget] = useState<Transaction | null>(null);
  const [revertTarget, setRevertTarget] = useState<Transaction | null>(null);

  const transactions = useMemo(() => overview?.transactions ?? [], [overview]);
  const clients = useMemo(() => overview?.clients ?? [], [overview]);

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  // Counts for filter chips
  const counts = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pending = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'PENDING') {
        pending += 1;
      }
      if (tx.type === 'INCOME') {
        income += 1;
      } else if (tx.type === 'EXPENSE') {
        expense += 1;
      }
    });

    return {
      all: transactions.length,
      income,
      expense,
      pending,
    };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    return transactions.filter((tx) => {
      // Filter tab logic
      if (filter === 'income') {
        if (tx.type !== 'INCOME') return false;
      } else if (filter === 'expense') {
        if (tx.type !== 'EXPENSE') return false;
      } else if (filter === 'pending') {
        if (tx.status !== 'PENDING') return false;
      }

      // Search query
      if (!normalized) return true;
      const name = (tx.name || '').toLowerCase();
      const notes = (tx.notes || '').toLowerCase();
      return name.includes(normalized) || notes.includes(normalized);
    });
  }, [transactions, filter, searchQuery]);

  // Helper for human-friendly relative date titles
  const getSectionTitle = useCallback(
    (isoDate: string) => {
      const date = parseCalendarDate(isoDate);
      const now = new Date();
      const todayStr = formatCalendarDate(now);

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatCalendarDate(yesterday);

      const itemDateStr = isoDate.slice(0, 10);

      if (itemDateStr === todayStr) {
        return t('dashboard.relativeDate.today');
      }
      if (itemDateStr === yesterdayStr) {
        return t('dashboard.relativeDate.yesterday');
      }

      return formatDate(date, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    },
    [formatDate, t]
  );

  // Section grouping
  const sections = useMemo(() => {
    const groups = new Map<string, { title: string; dateKey: string; totalAmount: number; data: Transaction[] }>();

    // Sort descending by date
    const sorted = [...filteredTransactions].sort((a, b) => {
      const dateA = new Date(a.expectedDate || a.date).getTime();
      const dateB = new Date(b.expectedDate || b.date).getTime();
      return dateB - dateA;
    });

    sorted.forEach((tx) => {
      const rawDate = tx.expectedDate || tx.date;
      const dateKey = rawDate ? rawDate.slice(0, 10) : 'unknown';

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          title: getSectionTitle(rawDate || formatCalendarDate(new Date())),
          dateKey,
          totalAmount: 0,
          data: [],
        });
      }

      const group = groups.get(dateKey)!;
      group.data.push(tx);
      const signedDelta = tx.type === 'INCOME' ? tx.amount : -tx.amount;
      group.totalAmount += signedDelta;
    });

    return Array.from(groups.values());
  }, [filteredTransactions, getSectionTitle]);

  const handleRowPress = useCallback(
    (tx: Transaction) => {
      router.push({ pathname: '/transaction/[id]', params: { id: tx.id } } as any);
    },
    [router]
  );

  const handleOpenCompleteModal = useCallback((tx: Transaction) => {
    setFeedbackMessage(null);
    setCompleteTarget(tx);
  }, []);

  const handleConfirmComplete = async (id: string, completedDate: string) => {
    if (!isOnline || completeMutation.isPending) return;
    await completeMutation.mutateAsync({ id, data: { completedDate } });
    setFeedbackMessage({ tone: 'positive', text: t('transactions.pending.completeSuccess') });
    setCompleteTarget(null);
  };

  const handleOpenRevertModal = useCallback((tx: Transaction) => {
    setFeedbackMessage(null);
    setRevertTarget(tx);
  }, []);

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: TransactionSection }) => {
      const isPositive = section.totalAmount >= 0;
      const formattedSum = formatCurrency(Math.abs(section.totalAmount), currency);
      const signedSum = `${isPositive ? '+' : '-'}${formattedSum}`;

      return (
        <View
          style={[styles.sectionHeader, { backgroundColor: theme.colors.bg }]}
          testID={`section-header-${section.dateKey}`}
        >
          <Text style={[theme.typography.captionUpper, { color: theme.colors.textSecondary }]}>
            {section.title}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              styles.sectionTotal,
              { color: isPositive ? theme.colors.positiveText : theme.colors.negativeText },
            ]}
          >
            {signedSum}
          </Text>
        </View>
      );
    },
    [currency, formatCurrency, theme]
  );

  const handleDeleteTransaction = useCallback(
    (tx: Transaction) => {
      deleteMutation.mutate(tx.id);
    },
    [deleteMutation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow
        transaction={item}
        currency={currency}
        onPress={handleRowPress}
        onDelete={handleDeleteTransaction}
        onCompletePending={handleOpenCompleteModal}
        onRevertPending={handleOpenRevertModal}
        showPendingActions={filter === 'pending' || Boolean(item.expectedDate && item.status === 'COMPLETED')}
      />
    ),
    [currency, filter, handleRowPress, handleDeleteTransaction, handleOpenCompleteModal, handleOpenRevertModal]
  );

  const handleConfirmRevert = async (id: string) => {
    if (!isOnline || revertMutation.isPending) return;
    await revertMutation.mutateAsync(id);
    setFeedbackMessage({ tone: 'positive', text: t('transactions.pending.revertSuccess') });
    setRevertTarget(null);
  };

  // Loading skeleton
  if (isLoading && !overview) {
    return (
      <ScreenContainer testID="transactions-loading-skeleton" edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <View
            style={[
              styles.skeletonBox,
              {
                height: 32,
                width: 160,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.md,
                marginBottom: 16,
              },
            ]}
          />
          <View
            style={[
              styles.skeletonBox,
              {
                height: 48,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.md,
                marginBottom: 16,
              },
            ]}
          />
          <View style={styles.chipsRow}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.skeletonBox,
                  {
                    height: 38,
                    width: 70,
                    backgroundColor: theme.colors.surfaceElevated,
                    borderRadius: theme.radius.full,
                  },
                ]}
              />
            ))}
          </View>
          <View
            style={[
              styles.skeletonBox,
              {
                height: 240,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.lg,
                marginTop: 20,
              },
            ]}
          />
        </View>
      </ScreenContainer>
    );
  }

  // Error state
  if (isError && !overview) {
    return (
      <ScreenContainer testID="transactions-error-state" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorCircle, { backgroundColor: theme.colors.negativeTint }]}>
            <AlertCircle size={40} color={theme.colors.negative} />
          </View>
          <Text
            accessibilityRole="header"
            style={[theme.typography.title, styles.errorTitle, { color: theme.colors.text }]}
          >
            {t('dashboard.alert.syncIssue')}
          </Text>
          <Text style={[theme.typography.body, styles.errorMessage, { color: theme.colors.textSecondary }]}>
            {error?.message || t('dashboard.error.load')}
          </Text>
          <Button variant="primary" onPress={() => refetch()} testID="transactions-retry-button">
            {t('offline.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // Determine empty state message and action
  let emptyTitle = t('transactions.empty.title');
  let emptyBody = t('transactions.empty.all');
  let emptyActionLabel = t('transactions.add');
  let onEmptyAction = () => router.push('/transaction/new' as any);

  if (searchQuery.trim()) {
    emptyBody = t('transactions.empty.bodySearch');
    emptyActionLabel = t('transactions.actions.clearSearch');
    onEmptyAction = () => setSearchQuery('');
  } else if (filter === 'income') {
    emptyBody = t('transactions.empty.income');
    emptyActionLabel = t('transactions.fab.addIncome');
    onEmptyAction = () => router.push({ pathname: '/transaction/new', params: { type: 'INCOME' } } as any);
  } else if (filter === 'expense') {
    emptyBody = t('transactions.empty.expense');
    emptyActionLabel = t('transactions.fab.addExpense');
    onEmptyAction = () => router.push({ pathname: '/transaction/new', params: { type: 'EXPENSE' } } as any);
  } else if (filter === 'pending') {
    emptyBody = t('transactions.empty.pending');
    emptyActionLabel = t('transactions.fab.addIncome');
    onEmptyAction = () => router.push({ pathname: '/transaction/new', params: { type: 'INCOME' } } as any);
  }

  return (
    <ScreenContainer
      testID="transactions-screen"
      edges={['top', 'left', 'right']}
      showOfflineBanner={false}
      scrollable={false}
      padded={false}
    >
      <View style={styles.container}>
        {/* Title Header */}
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[theme.typography.h1, { color: theme.colors.text }]}
          >
            {t('tabs.transactions')}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {filteredTransactions.length === 1
              ? t('transactions.ledger.shown', { count: 1 })
              : t('transactions.ledger.shownPlural', { count: filteredTransactions.length })}
          </Text>
        </View>

        {/* Offline Banner */}
        {!isOnline && (
          <View style={styles.bannerSpacing}>
            <Banner
              tone="warning"
              title={t('offline.title')}
              message={t('offline.body')}
              testID="offline-banner"
            />
          </View>
        )}

        {/* Action feedback */}
        {feedbackMessage && (
          <View style={styles.bannerSpacing}>
            <Banner
              tone={feedbackMessage.tone === 'positive' ? 'success' : 'error'}
              title={feedbackMessage.text}
              testID="action-feedback-banner"
            />
          </View>
        )}

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Search size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            testID="transactions-search-input"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('transactions.search.placeholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={[
              theme.typography.body,
              styles.searchInput,
              { color: theme.colors.text },
            ]}
            accessibilityLabel={t('transactions.search.placeholder')}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              testID="transactions-clear-search"
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('transactions.actions.clearSearch')}
              hitSlop={8}
              style={styles.clearSearchBtn}
            >
              <X size={16} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.chipsRow}>
          <FilterChip
            label={t('transactions.filters.all')}
            count={counts.all}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
            testID="filter-chip-all"
          />
          <FilterChip
            label={t('transactions.filters.income')}
            count={counts.income}
            active={filter === 'income'}
            onPress={() => setFilter('income')}
            testID="filter-chip-income"
          />
          <FilterChip
            label={t('transactions.filters.expense')}
            count={counts.expense}
            active={filter === 'expense'}
            onPress={() => setFilter('expense')}
            testID="filter-chip-expense"
          />
          <FilterChip
            label={t('transactions.filters.pending')}
            count={counts.pending}
            active={filter === 'pending'}
            onPress={() => setFilter('pending')}
            testID="filter-chip-pending"
          />
        </View>

        {/* Transactions List or Empty State */}
        {sections.length === 0 ? (
          <View style={styles.emptyContainer} testID="transactions-empty-state">
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Receipt size={36} color={theme.colors.accent} />
            </View>
            <Text
              style={[theme.typography.h2, styles.emptyTitle, { color: theme.colors.text }]}
              accessibilityRole="header"
            >
              {emptyTitle}
            </Text>
            <Text
              style={[theme.typography.body, styles.emptyBody, { color: theme.colors.textSecondary }]}
            >
              {emptyBody}
            </Text>
            <Button
              variant="primary"
              onPress={onEmptyAction}
              testID="transactions-empty-action"
              style={styles.emptyAction}
            >
              {emptyActionLabel}
            </Button>
          </View>
        ) : (
          <SectionList
            testID="transactions-section-list"
            sections={sections}
            keyExtractor={keyExtractor}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={9}
            refreshControl={
              <RefreshControl
                refreshing={Boolean(isRefetching)}
                onRefresh={refetch}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            }
            renderSectionHeader={renderSectionHeader}
            renderItem={renderItem}
            onScrollBeginDrag={closeOpenSwipeables}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Pending Modals */}
      <CompletePendingModal
        visible={Boolean(completeTarget)}
        transaction={completeTarget}
        clientName={completeTarget?.clientId ? clientMap.get(completeTarget.clientId) : undefined}
        currency={currency}
        onClose={() => setCompleteTarget(null)}
        onConfirm={handleConfirmComplete}
        isLoading={completeMutation.isPending}
      />

      <RevertPendingModal
        visible={Boolean(revertTarget)}
        transaction={revertTarget}
        currency={currency}
        onClose={() => setRevertTarget(null)}
        onConfirm={handleConfirmRevert}
        isLoading={revertMutation.isPending}
      />
    </ScreenContainer>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
  testID,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.colors.accent : theme.colors.surface,
          borderColor: active ? theme.colors.accent : theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          theme.typography.smallMedium,
          {
            color: active ? theme.colors.accentFg : theme.colors.text,
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.chipBadge,
          {
            backgroundColor: active ? 'rgba(255, 255, 255, 0.25)' : theme.colors.surfaceElevated,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.micro,
            {
              color: active ? theme.colors.accentFg : theme.colors.textMuted,
            },
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bannerSpacing: {
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48, // >= 44pt touch target
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginEnd: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44, // >= 44pt touch target
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTotal: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyAction: {
    width: 'auto',
    minWidth: 160,
  },
  skeletonBox: {
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 24,
  },
});
