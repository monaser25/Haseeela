import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  TrendingUp,
  Clock,
  Info,
  CheckCircle2,
} from 'lucide-react-native';
import type { NotificationItem } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useAuth } from '../../auth';
import { getSessionEpoch, getCurrentAuthUserId } from '../../auth/authScope';
import { useNotifications, useMarkNotificationsRead } from '../../api';
import { useIsOnline } from '../../query';
import { Button, Banner, ScreenContainer } from '../../components/ui';
import {
  resolveNotificationRoute,
  groupNotificationDate,
  formatNotificationTime,
} from '../../utils/notificationHelpers';

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, isRTL } = useI18n();
  const { user, status: authStatus } = useAuth();
  const isOnline = useIsOnline();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useNotifications();

  const markReadMutation = useMarkNotificationsRead();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Synchronous operation lock across single-row and mark-all actions
  const activeOpRef = useRef<{ id: number; ownerId: string; epoch: number } | null>(null);
  const opSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Reset ALL owner-bound state on actual account change
  const prevOwnerRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevOwnerRef.current && prevOwnerRef.current !== user?.id) {
      activeOpRef.current = null;
      setPendingId(null);
      setActionError(null);
      setFilter('all');
    }
    prevOwnerRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeOpRef.current = null;
    };
  }, []);

  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);
  const unreadCount = data?.unread ?? notifications.filter((n) => !n.read).length;
  const totalCount = notifications.length;

  const isBusy = Boolean(activeOpRef.current) || markReadMutation.isPending || !isOnline;

  const displayedNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  // Group notifications into Today, Yesterday, Earlier
  const groupedSections = useMemo(() => {
    const todayList: NotificationItem[] = [];
    const yesterdayList: NotificationItem[] = [];
    const earlierList: NotificationItem[] = [];

    displayedNotifications.forEach((item) => {
      const group = groupNotificationDate(item.createdAt);
      if (group === 'today') {
        todayList.push(item);
      } else if (group === 'yesterday') {
        yesterdayList.push(item);
      } else {
        earlierList.push(item);
      }
    });

    const sections: { key: string; title: string; items: NotificationItem[] }[] = [];
    if (todayList.length > 0) {
      sections.push({
        key: 'today',
        title: t('notifications.group.today'),
        items: todayList,
      });
    }
    if (yesterdayList.length > 0) {
      sections.push({
        key: 'yesterday',
        title: t('notifications.group.yesterday'),
        items: yesterdayList,
      });
    }
    if (earlierList.length > 0) {
      sections.push({
        key: 'earlier',
        title: t('notifications.group.earlier'),
        items: earlierList,
      });
    }

    return sections;
  }, [displayedNotifications, t]);

  const handleMarkAllRead = async () => {
    if (activeOpRef.current !== null || !user?.id || !isOnline || unreadCount === 0) return;

    const opId = ++opSeqRef.current;
    const initiatingOwnerId = user.id;
    const initiatingEpoch = getSessionEpoch();
    activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
    setActionError(null);

    try {
      await markReadMutation.mutateAsync(undefined);
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        activeOpRef.current = null;
      }
    } catch {
      if (
        isMountedRef.current &&
        activeOpRef.current?.id === opId &&
        getSessionEpoch() === initiatingEpoch &&
        getCurrentAuthUserId() === initiatingOwnerId
      ) {
        setActionError(t('settings.toast.saveFailed'));
        activeOpRef.current = null;
      }
    }
  };

  const handlePressRow = async (item: NotificationItem) => {
    const targetRoute = resolveNotificationRoute(item.link);

    // If item is unread and online, mark it read under synchronous lock
    if (!item.read && isOnline && user?.id) {
      if (activeOpRef.current !== null) return; // Prevent concurrent duplicate or cross actions

      const opId = ++opSeqRef.current;
      const initiatingOwnerId = user.id;
      const initiatingEpoch = getSessionEpoch();
      activeOpRef.current = { id: opId, ownerId: initiatingOwnerId, epoch: initiatingEpoch };
      setPendingId(item.id);
      setActionError(null);

      try {
        await markReadMutation.mutateAsync(item.id);
      } catch {
        if (
          isMountedRef.current &&
          activeOpRef.current?.id === opId &&
          getSessionEpoch() === initiatingEpoch &&
          getCurrentAuthUserId() === initiatingOwnerId
        ) {
          setActionError(t('settings.toast.saveFailed'));
          setPendingId(null);
          activeOpRef.current = null;
        }
        return;
      }

      if (
        !isMountedRef.current ||
        activeOpRef.current?.id !== opId ||
        getSessionEpoch() !== initiatingEpoch ||
        getCurrentAuthUserId() !== initiatingOwnerId
      ) {
        return; // Session changed or unmounted
      }

      setPendingId(null);
      activeOpRef.current = null;
    }

    // Only navigate to allowlisted targets if still mounted
    if (isMountedRef.current && targetRoute) {
      router.push(targetRoute as any);
    }
  };

  // Helper to render type-specific icons
  const renderIcon = (type: string) => {
    switch (type) {
      case 'BILLING_DUE':
        return (
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.warningTint }]}>
            <Clock size={18} color={theme.colors.warning} />
          </View>
        );
      case 'INVOICE_OVERDUE':
        return (
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.negativeTint }]}>
            <AlertCircle size={18} color={theme.colors.negative} />
          </View>
        );
      case 'PAYMENT_RECORDED':
        return (
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.positiveTint }]}>
            <TrendingUp size={18} color={theme.colors.positive} />
          </View>
        );
      case 'WEEKLY_SUMMARY':
        return (
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.infoTint }]}>
            <Calendar size={18} color={theme.colors.info} />
          </View>
        );
      default:
        return (
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentTint }]}>
            <Info size={18} color={theme.colors.accent} />
          </View>
        );
    }
  };

  // Cold loading skeleton (auth resolving or notifications loading with no cache)
  if ((authStatus === 'loading' || isLoading) && !data) {
    return (
      <ScreenContainer testID="notifications-loading-screen" edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.body,
              styles.loadingText,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('notifications.empty.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Cold error state
  if (isError && !data) {
    return (
      <ScreenContainer testID="notifications-error-screen" edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text
            style={[
              theme.typography.h2,
              styles.errorTitle,
              { color: theme.colors.text },
            ]}
          >
            {t('notifications.error.generic')}
          </Text>
          <Text
            style={[
              theme.typography.body,
              styles.errorBody,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.retryButton}
            testID="notifications-retry-button"
          >
            {t('notifications.action.retry')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  const isMarkAllDisabled = isBusy || unreadCount === 0;

  return (
    <ScreenContainer testID="notifications-screen" edges={['top', 'left', 'right']} scrollable={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="notifications-back-button"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.currency.back')}
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
        >
          <ArrowLeft
            size={22}
            color={theme.colors.text}
            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </Pressable>

        <Text
          accessibilityRole="header"
          style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}
        >
          {t('notifications.title')}
        </Text>

        <Pressable
          testID="notifications-mark-all-button"
          accessibilityRole="button"
          accessibilityLabel={t('notifications.actions.markAllRead')}
          onPress={handleMarkAllRead}
          disabled={isMarkAllDisabled}
          hitSlop={8}
          style={({ pressed }) => [
            styles.markAllBtn,
            { opacity: isMarkAllDisabled ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          {markReadMutation.isPending && !pendingId ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Text style={[styles.markAllText, { color: theme.colors.accent }]}>
              {t('notifications.actions.markAllRead')}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Segmented Filter Control */}
      <View style={styles.filterContainer}>
        <View
          style={[
            styles.segmentedTrack,
            {
              backgroundColor: theme.colors.surfaceHover,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Pressable
            testID="notif-tab-all"
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'all' }}
            onPress={() => setFilter('all')}
            style={[
              styles.segmentedItem,
              filter === 'all' && {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.caption,
                styles.segmentedText,
                {
                  color: filter === 'all' ? theme.colors.text : theme.colors.textSecondary,
                  fontWeight: filter === 'all' ? '600' : '500',
                },
              ]}
            >
              {t('notifications.tabs.all')} · {totalCount}
            </Text>
          </Pressable>

          <Pressable
            testID="notif-tab-unread"
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'unread' }}
            onPress={() => setFilter('unread')}
            style={[
              styles.segmentedItem,
              filter === 'unread' && {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.caption,
                styles.segmentedText,
                {
                  color: filter === 'unread' ? theme.colors.text : theme.colors.textSecondary,
                  fontWeight: filter === 'unread' ? '600' : '500',
                },
              ]}
            >
              {t('notifications.tabs.unread')} · {unreadCount}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* Offline Banner */}
        {!isOnline ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('notifications.offlineBanner')}
              testID="notifications-offline-banner"
            />
          </View>
        ) : null}

        {/* Stale Error Banner */}
        {isError && data ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="warning"
              message={t('offline.body')}
              testID="notifications-stale-banner"
            />
          </View>
        ) : null}

        {/* Action Error Banner */}
        {actionError ? (
          <View style={styles.bannerWrapper}>
            <Banner
              tone="error"
              message={actionError}
              testID="notifications-action-error-banner"
            />
          </View>
        ) : null}

        {/* Empty State */}
        {displayedNotifications.length === 0 ? (
          <View style={styles.emptyContainer} testID="notifications-empty-state">
            <CheckCircle2 size={44} color={theme.colors.textMuted} />
            <Text
              accessibilityRole="header"
              style={[theme.typography.h3, styles.emptyTitle, { color: theme.colors.text }]}
            >
              {filter === 'unread'
                ? t('notifications.empty.noUnread')
                : t('notifications.empty.caughtUp')}
            </Text>
            <Text
              style={[
                theme.typography.body,
                styles.emptyBody,
                { color: theme.colors.textSecondary },
              ]}
            >
              {t('notifications.empty.body')}
            </Text>
          </View>
        ) : null}

        {/* Grouped Notifications */}
        {groupedSections.map((section) => (
          <View key={section.key} style={styles.sectionWrapper}>
            <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
              {section.title}
            </Text>

            <View
              style={[
                styles.listCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              {section.items.map((item, index) => {
                const isItemPending = pendingId === item.id;
                const isLast = index === section.items.length - 1;
                const formattedTime = formatNotificationTime(item.createdAt, t);

                return (
                  <Pressable
                    key={item.id}
                    testID={`notification-row-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.body || ''}. ${
                      !item.read ? t('notifications.unreadBadge') : ''
                    }`}
                    onPress={() => handlePressRow(item)}
                    disabled={Boolean(activeOpRef.current) || isItemPending}
                    style={({ pressed }) => [
                      styles.notifRow,
                      {
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: theme.colors.border,
                        backgroundColor: pressed
                          ? theme.colors.surfaceHover
                          : 'transparent',
                        opacity: isItemPending ? 0.6 : 1,
                      },
                    ]}
                  >
                    {renderIcon(item.type)}

                    <View style={styles.rowBody}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            theme.typography.bodySemiBold,
                            styles.notifTitle,
                            {
                              color: theme.colors.text,
                              fontWeight: !item.read ? '600' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {!item.read ? (
                          <View
                            style={[
                              styles.unreadDot,
                              { backgroundColor: theme.colors.accent },
                            ]}
                            testID={`unread-dot-${item.id}`}
                            accessibilityLabel={t('notifications.unreadBadge')}
                          />
                        ) : null}
                      </View>

                      {item.body ? (
                        <Text
                          style={[
                            theme.typography.caption,
                            styles.notifBody,
                            { color: theme.colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {item.body}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={[
                        theme.typography.caption,
                        styles.notifTime,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {formattedTime}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  markAllBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    minHeight: 36,
  },
  segmentedText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  bannerWrapper: {
    marginBottom: 4,
  },
  sectionWrapper: {
    gap: 6,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  listCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
    marginEnd: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTitle: {
    flexShrink: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  notifBody: {
    marginTop: 3,
    lineHeight: 18,
  },
  notifTime: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    marginTop: 6,
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
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
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 8,
    minWidth: 140,
  },
});
