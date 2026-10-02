import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Subscription, CurrencyCode } from '@haseela/shared';
import { getSubscriptionBurden, daysUntilDate } from '@haseela/shared';
import {
  Plus,
  Archive,
  Search,
  X,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useOverview, usePreferences } from '../../api';
import { useIsOnline } from '../../query';
import { Button, Banner, ScreenContainer } from '../../components/ui';
import {
  SubscriptionBurdenCard,
  SubscriptionRow,
} from '../../components/subscriptions';

type CycleChip = 'ALL' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
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
  const currency: CurrencyCode = preferences?.currency || 'USD';

  const [cycleFilter, setCycleFilter] = useState<CycleChip>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const subscriptions = useMemo(() => overview?.subscriptions ?? [], [overview]);

  // Real stats calculation (no mock numbers)
  const stats = useMemo(() => {
    let active = 0;
    let dueSoon = 0;
    let archived = 0;

    subscriptions.forEach((s) => {
      const isArch = Boolean(s.archivedAt);
      if (isArch) {
        archived += 1;
      } else if (s.status === 'ACTIVE') {
        active += 1;
        const days = daysUntilDate(s.nextBillingDate);
        if (days !== null && days >= 0 && days <= 7) {
          dueSoon += 1;
        }
      }
    });

    const burden = getSubscriptionBurden(subscriptions);

    return {
      active,
      dueSoon,
      archived,
      burden,
    };
  }, [subscriptions]);

  // Filter & Search logic
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => {
      const isArchived = Boolean(s.archivedAt);

      if (showArchived && !isArchived) return false;
      if (!showArchived && isArchived) return false;

      const subCycle = s.billingCycle || s.cycle || 'MONTHLY';
      if (cycleFilter !== 'ALL' && subCycle !== cycleFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesNotes = Boolean(s.notes && s.notes.toLowerCase().includes(query));
        if (!matchesName && !matchesNotes) return false;
      }

      return true;
    });
  }, [subscriptions, showArchived, cycleFilter, searchQuery]);

  const handleAddSubscription = useCallback(() => {
    router.push('/subscription/new' as any);
  }, [router]);

  const handleSubscriptionPress = useCallback(
    (subscription: Subscription) => {
      router.push(`/subscription/${subscription.id}` as any);
    },
    [router]
  );

  const toggleArchive = useCallback(() => {
    setShowArchived((prev) => !prev);
  }, []);

  // Cold offline with empty cache
  if (!isOnline && !overview) {
    return (
      <ScreenContainer testID="subscriptions-offline-screen" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.retryButton}
          >
            {t('offline.action.retry')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.retryButton}
          >
            {t('onboarding.currency.back')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // Loading skeleton when no cached overview
  if ((isLoading || (!overview && !isError && isOnline)) && !overview) {
    return (
      <ScreenContainer testID="subscriptions-loading-screen" edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.body,
              styles.loadingText,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('subscriptions.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Error state when no cache is available
  if (isError && !overview) {
    return (
      <ScreenContainer testID="subscriptions-error-screen" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('subscriptions.error.generic')}
          </Text>
          <Text
            style={[
              theme.typography.body,
              styles.errorBody,
              { color: theme.colors.textSecondary },
            ]}
          >
            {error instanceof Error ? error.message : t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.retryButton}
          >
            {t('offline.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="subscriptions-list-screen" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Pressable
            testID="subscriptions-back-button"
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.currency.back')}
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backBtn}
          >
            <ArrowLeft size={22} color={theme.colors.text} />
          </Pressable>

          <Text
            accessibilityRole="header"
            style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}
          >
            {t('subscriptions.title')}
          </Text>

          <View style={styles.headerActions}>
            <Pressable
              testID="subscriptions-toggle-archive-button"
              accessibilityRole="button"
              accessibilityLabel={
                showArchived
                  ? t('subscriptions.filters.active')
                  : t('subscriptions.filters.archived')
              }
              accessibilityState={{ selected: showArchived }}
              onPress={toggleArchive}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: showArchived
                    ? theme.colors.accentTint
                    : theme.colors.surfaceHover,
                  borderColor: showArchived
                    ? theme.colors.accent
                    : theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Archive
                size={20}
                color={showArchived ? theme.colors.accent : theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              testID="subscriptions-add-button"
              accessibilityRole="button"
              accessibilityLabel={t('subscriptions.addSubscription')}
              disabled={!isOnline}
              onPress={handleAddSubscription}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                styles.addBtn,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: !isOnline ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Plus size={20} color={theme.colors.accentFg} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* Offline Banner */}
        {!isOnline && (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('subscriptions.offline.banner')}
            />
          </View>
        )}

        {/* Stale Cached Data Feedback */}
        {Boolean(isError && overview) && (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('errors.cachedData')}
            />
          </View>
        )}
      </View>

      {/* Main FlatList */}
      <FlatList
        testID="subscriptions-list"
        data={filteredSubscriptions}
        extraData={filteredSubscriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SubscriptionRow
            subscription={item}
            currency={currency}
            onPress={() => handleSubscriptionPress(item)}
            testID={`subscription-row-${item.id}`}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Burden Card */}
            <SubscriptionBurdenCard
              burden={stats.burden}
              activeCount={stats.active}
              dueSoonCount={stats.dueSoon}
              currency={currency}
            />

            {/* Cycle Filter Chips */}
            <View style={styles.chipsRow}>
              {(['ALL', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((chip) => {
                const isSelected = cycleFilter === chip;
                const label =
                  chip === 'ALL'
                    ? t('subscriptions.chips.all')
                    : chip === 'MONTHLY'
                    ? t('subscriptions.chips.monthly')
                    : chip === 'QUARTERLY'
                    ? t('subscriptions.chips.quarterly')
                    : t('subscriptions.chips.yearly');

                return (
                  <Pressable
                    key={chip}
                    testID={`subscriptions-chip-${chip.toLowerCase()}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setCycleFilter(chip)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.surface,
                        borderColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? theme.colors.accentFg
                            : theme.colors.textSecondary,
                          fontWeight: isSelected ? '600' : '400',
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Search size={18} color={theme.colors.textMuted} />
              <TextInput
                testID="subscriptions-search-input"
                style={[
                  theme.typography.body,
                  styles.searchInput,
                  { color: theme.colors.text },
                ]}
                placeholder={t('subscriptions.searchPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                accessibilityLabel={t('subscriptions.searchPlaceholder')}
              />
              {Boolean(searchQuery) && (
                <Pressable
                  testID="subscriptions-search-clear"
                  onPress={() => setSearchQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('subscriptions.clearSearch')}
                  hitSlop={8}
                >
                  <X size={16} color={theme.colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View testID="subscriptions-empty-state" style={styles.emptyContainer}>
            {searchQuery ? (
              <>
                <Text
                  style={[
                    theme.typography.h3,
                    styles.emptyTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  {t('subscriptions.noSearchResults')}
                </Text>
                <Button
                  variant="secondary"
                  onPress={() => setSearchQuery('')}
                  style={styles.emptyButton}
                >
                  {t('subscriptions.clearSearch')}
                </Button>
              </>
            ) : showArchived ? (
              <Text
                style={[
                  theme.typography.body,
                  styles.emptyBody,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {t('archive.empty.title')}
              </Text>
            ) : (
              <>
                <Text
                  style={[
                    theme.typography.h3,
                    styles.emptyTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  {t('subscriptions.empty.title')}
                </Text>
                <Text
                  style={[
                    theme.typography.body,
                    styles.emptyBody,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('subscriptions.empty.body')}
                </Text>
                <Button
                  variant="primary"
                  onPress={handleAddSubscription}
                  disabled={!isOnline}
                  style={styles.emptyButton}
                >
                  {t('subscriptions.addSubscription')}
                </Button>
              </>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 4,
  },
  title: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    borderWidth: 0,
  },
  bannerWrapper: {
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  listHeader: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  emptyButton: {
    minWidth: 160,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 8,
    minWidth: 140,
  },
});
