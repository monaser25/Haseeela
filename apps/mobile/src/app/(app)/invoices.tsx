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
import type { Invoice, InvoiceStatus, CurrencyCode } from '@haseela/shared';
import { effectiveInvoiceStatus } from '@haseela/shared';
import {
  Plus,
  Search,
  X,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useInvoices, usePreferences } from '../../api';
import { useIsOnline } from '../../query';
import { Button, Banner, ScreenContainer } from '../../components/ui';
import {
  InvoiceSummaryCards,
  InvoiceRow,
} from '../../components/invoices';

type FilterChip = 'ALL' | InvoiceStatus;

export default function InvoicesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const {
    data: invoicesData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInvoices();

  const { data: preferences } = usePreferences();
  const defaultCurrency: CurrencyCode = preferences?.currency || 'USD';

  const [statusFilter, setStatusFilter] = useState<FilterChip>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const invoices = useMemo(() => invoicesData ?? [], [invoicesData]);

  // Compute status counts for filter chips
  const filterCounts = useMemo(() => {
    const counts: Record<FilterChip, number> = {
      ALL: invoices.length,
      DRAFT: 0,
      SENT: 0,
      PAID: 0,
      OVERDUE: 0,
    };

    invoices.forEach((inv) => {
      const status = effectiveInvoiceStatus(inv.status, inv.dueDate);
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [invoices]);

  // Filter & Search logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const effectiveStatus = effectiveInvoiceStatus(inv.status, inv.dueDate);

      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const numberMatch = (inv.number || '').toLowerCase().includes(query);
        const clientName = inv.client?.name || inv.client?.company || '';
        const clientMatch = clientName.toLowerCase().includes(query);
        if (!numberMatch && !clientMatch) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const handleAddInvoice = useCallback(() => {
    if (!isOnline) return;
    router.push('/(app)/invoice/new' as any);
  }, [isOnline, router]);

  const handleInvoicePress = useCallback(
    (invoice: Invoice) => {
      router.push(`/(app)/invoice/${invoice.id}` as any);
    },
    [router]
  );

  const keyExtractor = useCallback((item: Invoice) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Invoice }) => (
      <View style={styles.rowWrapper}>
        <InvoiceRow
          invoice={item}
          onPress={handleInvoicePress}
          testID={`invoice-row-${item.id}`}
        />
      </View>
    ),
    [handleInvoicePress]
  );

  // Cold offline with empty cache
  if (!isOnline && !invoicesData) {
    return (
      <ScreenContainer testID="invoices-offline-screen" edges={['top', 'left', 'right']}>
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
            testID="invoices-offline-retry-btn"
          >
            {t('offline.action.retry')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.retryButton}
            testID="invoices-offline-back-btn"
          >
            {t('onboarding.currency.back')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // Loading skeleton when no cached invoices
  if ((isLoading || (!invoicesData && !isError && isOnline)) && !invoicesData) {
    return (
      <ScreenContainer testID="invoices-loading-screen" edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.body,
              styles.loadingText,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('invoices.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Error state when no cache is available
  if (isError && !invoicesData) {
    return (
      <ScreenContainer testID="invoices-error-screen" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('invoices.error.loadTitle')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.retryButton}
            testID="invoices-error-retry-btn"
          >
            {t('invoices.retry')}
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

  const chips: Array<{ id: FilterChip; label: string; count: number }> = [
    { id: 'ALL', label: t('invoices.status.all'), count: filterCounts.ALL },
    { id: 'DRAFT', label: t('invoices.status.draft'), count: filterCounts.DRAFT },
    { id: 'SENT', label: t('invoices.status.sent'), count: filterCounts.SENT },
    { id: 'PAID', label: t('invoices.status.paid'), count: filterCounts.PAID },
    { id: 'OVERDUE', label: t('invoices.status.overdue'), count: filterCounts.OVERDUE },
  ];

  return (
    <ScreenContainer
      testID="invoices-list-screen"
      edges={['top', 'left', 'right']}
      scrollable={false}
      padded={false}
    >
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('invoices.editor.back')}
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.iconButton}
          testID="invoices-back-btn"
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </Pressable>

        <Text
          accessibilityRole="header"
          style={[theme.typography.h2, styles.navTitle, { color: theme.colors.text }]}
          testID="invoices-header-title"
        >
          {t('invoices.title')}
        </Text>

        <View style={styles.navActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('invoices.searchPlaceholder')}
            onPress={() => setIsSearchVisible((prev) => !prev)}
            hitSlop={8}
            style={styles.iconButton}
            testID="invoices-toggle-search-btn"
          >
            <Search size={22} color={isSearchVisible ? theme.colors.accent : theme.colors.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('invoices.newInvoice')}
            onPress={handleAddInvoice}
            disabled={!isOnline}
            hitSlop={8}
            style={[
              styles.iconButton,
              !isOnline && { opacity: 0.5 },
            ]}
            testID="invoices-add-btn"
          >
            <Plus size={22} color={!isOnline ? theme.colors.textMuted : theme.colors.accent} />
          </Pressable>
        </View>
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.bannerContainer}>
          <Banner
            tone="warning"
            message={t('invoices.offline.readOnly')}
            testID="invoices-offline-banner"
          />
        </View>
      )}

      {/* Stale Error Banner with Retry */}
      {isError && invoicesData && (
        <View style={styles.bannerContainer}>
          <Banner
            tone="error"
            message={t('invoices.staleDataBanner')}
            testID="invoices-stale-banner"
          >
            <Button
              variant="secondary"
              onPress={() => refetch()}
              style={{ marginTop: 8 }}
              testID="invoices-stale-retry-btn"
            >
              {t('invoices.retry')}
            </Button>
          </Banner>
        </View>
      )}

      {/* FlatList with Summary Cards and Filters in Header */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={9}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Summary Cards */}
            <InvoiceSummaryCards
              invoices={invoices}
              defaultCurrency={defaultCurrency}
              testID="invoices-summary-cards"
            />

            {/* Optional Search Input */}
            {isSearchVisible && (
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Search size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('invoices.searchPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.searchInput,
                    {
                      color: theme.colors.text,
                    },
                  ]}
                  autoFocus
                  returnKeyType="search"
                  testID="invoices-search-input"
                />
                {Boolean(searchQuery) && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={8}
                    style={styles.clearSearchBtn}
                    testID="invoices-search-clear-btn"
                  >
                    <X size={16} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Status Filter Chips */}
            <View style={styles.chipRow}>
              {chips.map((chip) => {
                const isSelected = statusFilter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    testID={`invoice-filter-${chip.id.toLowerCase()}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${chip.label} (${chip.count})`}
                    onPress={() => setStatusFilter(chip.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.surface,
                        borderColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.border,
                        borderRadius: theme.radius.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        styles.chipText,
                        {
                          color: isSelected
                            ? theme.colors.surface
                            : theme.colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {`${chip.label} · ${chip.count}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="invoices-empty-view">
            <Text
              style={[
                theme.typography.h3,
                styles.emptyTitle,
                { color: theme.colors.text },
              ]}
              testID="invoices-empty-title"
            >
              {invoices.length === 0
                ? t('invoices.empty.noInvoicesTitle')
                : t('invoices.empty.noMatchTitle')}
            </Text>
            <Text
              style={[
                theme.typography.body,
                styles.emptyBody,
                { color: theme.colors.textSecondary },
              ]}
              testID="invoices-empty-body"
            >
              {invoices.length === 0
                ? t('invoices.empty.noInvoicesBody')
                : t('invoices.empty.noMatchBody')}
            </Text>
            {invoices.length === 0 && isOnline && (
              <Button
                variant="primary"
                onPress={handleAddInvoice}
                style={styles.emptyActionButton}
                testID="invoices-empty-create-btn"
              >
                {t('invoices.newInvoice')}
              </Button>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    marginStart: 8,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  listHeader: {
    gap: 14,
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: {
    marginEnd: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontVariant: ['tabular-nums'],
  },
  rowWrapper: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  errorTitle: {
    textAlign: 'center',
  },
  retryButton: {
    width: '100%',
    maxWidth: 280,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 12,
  },
  emptyActionButton: {
    minWidth: 160,
  },
});
