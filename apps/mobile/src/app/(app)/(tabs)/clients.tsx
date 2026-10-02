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
import type { Client } from '@haseela/shared';
import { getClientRevenue } from '@haseela/shared';
import {
  Plus,
  Archive,
  Search,
  X,
  AlertCircle,
  Users,
} from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useOverview, usePreferences } from '../../../api';
import { useIsOnline } from '../../../query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import { ClientRow } from '../../../components/clients/ClientRow';
import { ClientRevenueCard } from '../../../components/clients/ClientRevenueCard';

type ClientFilter = 'all' | 'active' | 'archived';

export default function ClientsScreen() {
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
  const currency = preferences?.currency || 'USD';

  const [filter, setFilter] = useState<ClientFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const clients = useMemo(() => overview?.clients ?? [], [overview]);
  const transactions = useMemo(() => overview?.transactions ?? [], [overview]);

  // Derived revenue per client from real completed income only
  const clientRevenueMap = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      map.set(c.id, getClientRevenue(transactions, c.id));
    });
    return map;
  }, [clients, transactions]);

  // Stats calculation
  const stats = useMemo(() => {
    let active = 0;
    let retainers = 0;
    let archived = 0;
    let totalRevenue = 0;

    clients.forEach((c) => {
      const isArchived = Boolean(c.archivedAt);
      const rev = clientRevenueMap.get(c.id) ?? 0;
      totalRevenue += rev;

      if (isArchived) {
        archived += 1;
      } else {
        if (c.status === 'ACTIVE') active += 1;
        if (c.paymentType === 'retainer') retainers += 1;
      }
    });

    // Top client by completed income
    let topName: string | undefined;
    let topRev = 0;
    clients.forEach((c) => {
      const rev = clientRevenueMap.get(c.id) ?? 0;
      if (rev > topRev) {
        topRev = rev;
        topName = c.name;
      }
    });

    return {
      active,
      retainers,
      archived,
      totalRevenue,
      topName,
      topRev,
    };
  }, [clients, clientRevenueMap]);

  // Filter & Search logic
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const isArchived = Boolean(c.archivedAt);

      if (filter === 'active' && isArchived) return false;
      if (filter === 'archived' && !isArchived) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesCompany = Boolean(c.company && c.company.toLowerCase().includes(query));
        const matchesEmail = Boolean(c.email && c.email.toLowerCase().includes(query));
        if (!matchesName && !matchesCompany && !matchesEmail) return false;
      }

      return true;
    });
  }, [clients, filter, searchQuery]);

  const handleAddClient = useCallback(() => {
    router.push('/client/new' as any);
  }, [router]);

  const handleClientPress = useCallback(
    (client: Client) => {
      router.push(`/client/${client.id}` as any);
    },
    [router]
  );

  const toggleArchiveFilter = useCallback(() => {
    setFilter((prev) => (prev === 'archived' ? 'active' : 'archived'));
  }, []);

  const keyExtractor = useCallback((item: Client) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Client }) => (
      <ClientRow
        client={item}
        currency={currency}
        totalPaid={clientRevenueMap.get(item.id) ?? 0}
        onPress={handleClientPress}
        testID={`client-row-${item.id}`}
      />
    ),
    [currency, clientRevenueMap, handleClientPress]
  );

  // Loading skeleton when no cached data exists
  if (isLoading && !overview) {
    return (
      <ScreenContainer testID="clients-tab-screen" edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[theme.typography.body, styles.loadingText, { color: theme.colors.textMuted }]}>
            {t('clients.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Error state when no cache is available
  if (isError && !overview) {
    return (
      <ScreenContainer testID="clients-tab-screen" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text style={[theme.typography.h2, styles.errorTitle, { color: theme.colors.text }]}>
            {t('clients.error.generic')}
          </Text>
          <Text style={[theme.typography.body, styles.errorBody, { color: theme.colors.textSecondary }]}>
            {error instanceof Error ? error.message : t('offline.body')}
          </Text>
          <Button variant="primary" onPress={() => refetch()} style={styles.retryButton}>
            {t('offline.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      testID="clients-tab-screen"
      edges={['top', 'left', 'right']}
      scrollable={false}
      padded={false}
    >
      {/* Compact Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text
            accessibilityRole="header"
            style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}
          >
            {t('clients.title')}
          </Text>

          <View style={styles.headerActions}>
            <Pressable
              testID="clients-toggle-archive-button"
              accessibilityRole="button"
              accessibilityLabel={filter === 'archived' ? t('clients.filters.active') : t('clients.filters.archived')}
              accessibilityState={{ selected: filter === 'archived' }}
              onPress={toggleArchiveFilter}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: filter === 'archived' ? theme.colors.accentTint : theme.colors.surfaceHover,
                  borderColor: filter === 'archived' ? theme.colors.accent : theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Archive
                size={20}
                color={filter === 'archived' ? theme.colors.accent : theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              testID="clients-add-button"
              accessibilityRole="button"
              accessibilityLabel={t('clients.addClient')}
              disabled={!isOnline}
              onPress={handleAddClient}
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
              message={t('clients.offline.banner')}
            />
          </View>
        )}
      </View>

      {/* Main FlatList */}
      <FlatList
        testID="clients-list"
        data={filteredClients}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={9}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Revenue Summary Card */}
            <ClientRevenueCard
              totalRevenue={stats.totalRevenue}
              activeCount={stats.active}
              retainerCount={stats.retainers}
              archivedCount={stats.archived}
              currency={currency}
              topClientName={stats.topName}
              topClientRevenue={stats.topRev}
            />

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
                testID="clients-search-input"
                style={[theme.typography.body, styles.searchInput, { color: theme.colors.text }]}
                placeholder={t('clients.searchPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                accessibilityLabel={t('clients.searchPlaceholder')}
              />
              {Boolean(searchQuery) && (
                <Pressable
                  testID="clients-search-clear"
                  onPress={() => setSearchQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('clients.clearSearch')}
                  hitSlop={8}
                >
                  <X size={16} color={theme.colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {(['all', 'active', 'archived'] as ClientFilter[]).map((f) => {
                const isSelected = filter === f;
                const label =
                  f === 'all'
                    ? t('clients.filters.all')
                    : f === 'active'
                    ? t('clients.filters.active')
                    : t('clients.filters.archived');
                return (
                  <Pressable
                    key={f}
                    testID={`clients-filter-${f}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setFilter(f)}
                    style={({ pressed }) => [
                      styles.filterChip,
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
                        styles.filterChipText,
                        {
                          color: isSelected
                            ? theme.colors.accentFg
                            : theme.colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="clients-empty-state">
            <View
              style={[
                styles.emptyIconCircle,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Users size={36} color={theme.colors.accent} />
            </View>
            <Text style={[theme.typography.h3, styles.emptyTitle, { color: theme.colors.text }]}>
              {searchQuery ? t('clients.noSearchResults') : t('clients.empty.title')}
            </Text>
            <Text
              style={[theme.typography.body, styles.emptySubtitle, { color: theme.colors.textSecondary }]}
            >
              {searchQuery ? '' : t('clients.empty.body')}
            </Text>
            {!searchQuery && (
              <Button
                variant="primary"
                onPress={handleAddClient}
                disabled={!isOnline}
                style={styles.emptyAddBtn}
                testID="clients-empty-add-button"
              >
                {t('clients.addClient')}
              </Button>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
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
  title: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44, // 44pt touch target
    borderRadius: 22,
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
  listHeader: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44, // 44pt target
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    minWidth: 140,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
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
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  emptyAddBtn: {
    marginTop: 18,
    minWidth: 160,
  },
});
