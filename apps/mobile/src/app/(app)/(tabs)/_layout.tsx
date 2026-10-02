import React, { useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, I18nManager, useWindowDimensions } from 'react-native';
import { Tabs, useRouter, useSegments, usePathname, type Href } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useReduceMotion } from '../../../components/motion';
import { TabBarFab } from '../../../components/navigation/TabBarFab';
import { FloatingTabBar, FloatingTabBarProps } from '../../../components/navigation/FloatingTabBar';
import { TabSwipeContext } from '../../../components/navigation/TabSwipeContext';
import { slotFor } from '../../../components/navigation/tabBarMetrics';

const TAB_ROUTES = [
  '/(app)/(tabs)',
  '/(app)/(tabs)/transactions',
  '/(app)/(tabs)/clients',
  '/(app)/(tabs)/more',
] as const;

function renderTabBar(props: unknown) {
  return <FloatingTabBar {...(props as FloatingTabBarProps)} />;
}

export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const isRTL = I18nManager.isRTL;

  const activeIndex = useMemo(() => {
    const last = segments[segments.length - 1];
    if (last === 'transactions' || pathname.includes('/transactions')) return 1;
    if (last === 'clients' || pathname.includes('/clients')) return 2;
    if (last === 'more' || pathname.includes('/more')) return 3;
    return 0; // index
  }, [segments, pathname]);

  const swipeProgress = useSharedValue(0);
  const isSwiping = useSharedValue(false);
  const targetSlot = useSharedValue(-1);
  const activeIndexShared = useSharedValue(activeIndex);

  useEffect(() => {
    activeIndexShared.value = activeIndex;
  }, [activeIndex, activeIndexShared]);

  const contextValue = useMemo(
    () => ({
      swipeProgress,
      isSwiping,
      targetSlot,
      activeIndex,
    }),
    [swipeProgress, isSwiping, targetSlot, activeIndex]
  );

  const onNavigateTab = useCallback(
    (newIdx: number) => {
      Haptics.selectionAsync().catch(() => {});
      const targetRoute = TAB_ROUTES[newIdx];
      if (targetRoute) {
        router.replace(targetRoute as unknown as Href);
      }
    },
    [router]
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-25, 25])
      .failOffsetY([-12, 12])
      .onStart(() => {
        'worklet';
        isSwiping.value = true;
        swipeProgress.value = 0;
        targetSlot.value = -1;
      })
      .onUpdate((e) => {
        'worklet';
        const delta = isRTL ? e.translationX : -e.translationX;
        const progress = delta / screenWidth;
        const clampedProgress = Math.max(-1, Math.min(1, progress));
        swipeProgress.value = clampedProgress;

        let targetIdx = -1;
        if (clampedProgress > 0 && activeIndexShared.value < TAB_ROUTES.length - 1) {
          targetIdx = activeIndexShared.value + 1;
        } else if (clampedProgress < 0 && activeIndexShared.value > 0) {
          targetIdx = activeIndexShared.value - 1;
        }

        if (targetIdx >= 0) {
          targetSlot.value = slotFor(targetIdx);
        } else {
          targetSlot.value = -1;
        }
      })
      .onEnd((e) => {
        'worklet';
        const delta = isRTL ? e.translationX : -e.translationX;
        const velocity = isRTL ? e.velocityX : -e.velocityX;
        const curIdx = activeIndexShared.value;
        const advance = (delta > 50 || velocity > 400) && curIdx < TAB_ROUTES.length - 1;
        const retreat = (delta < -50 || velocity < -400) && curIdx > 0;

        if (advance) {
          scheduleOnRN(onNavigateTab, curIdx + 1);
        } else if (retreat) {
          scheduleOnRN(onNavigateTab, curIdx - 1);
        }

        isSwiping.value = false;
        if (reduceMotion) {
          swipeProgress.value = 0;
        } else {
          swipeProgress.value = withSpring(0);
        }
        targetSlot.value = -1;
      })
      .onFinalize(() => {
        'worklet';
        if (isSwiping.value) {
          isSwiping.value = false;
          if (reduceMotion) {
            swipeProgress.value = 0;
          } else {
            swipeProgress.value = withSpring(0);
          }
          targetSlot.value = -1;
        }
      });
  }, [
    isRTL,
    screenWidth,
    activeIndexShared,
    isSwiping,
    swipeProgress,
    targetSlot,
    reduceMotion,
    onNavigateTab,
  ]);

  return (
    <TabSwipeContext.Provider value={contextValue}>
      <GestureDetector gesture={panGesture}>
        <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
          <Tabs
            tabBar={renderTabBar}
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              sceneStyle: { backgroundColor: theme.colors.bg },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: t('tabs.home'),
                tabBarAccessibilityLabel: t('tabs.home'),
              }}
            />
            <Tabs.Screen
              name="transactions"
              options={{
                title: t('tabs.transactions'),
                tabBarAccessibilityLabel: t('tabs.transactions'),
              }}
            />
            <Tabs.Screen
              name="clients"
              options={{
                title: t('tabs.clients'),
                tabBarAccessibilityLabel: t('tabs.clients'),
              }}
            />
            <Tabs.Screen
              name="more"
              options={{
                title: t('tabs.more'),
                tabBarAccessibilityLabel: t('tabs.more'),
              }}
            />
          </Tabs>
          <TabBarFab />
        </View>
      </GestureDetector>
    </TabSwipeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
