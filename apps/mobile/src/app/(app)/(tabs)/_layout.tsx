import React, { useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MaterialTopTabs from 'expo-router/js-top-tabs';
import {
  LocaleDirContext,
  type EventArg,
  type NavigationState,
} from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../theme';
import { useI18n, useIsRTL } from '../../../i18n';
import { useReduceMotion } from '../../../components/motion';
import { TabBarFab } from '../../../components/navigation/TabBarFab';
import {
  FloatingTabBar,
  type FloatingTabBarProps,
} from '../../../components/navigation/FloatingTabBar';

function renderTabBar(props: unknown) {
  return <FloatingTabBar {...(props as FloatingTabBarProps)} />;
}

export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const isRTL = useIsRTL();
  const reduceMotion = useReduceMotion();
  const lastIndexRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef(0);

  const handleTabPress = useCallback(() => {
    lastTapTimeRef.current = Date.now();
  }, []);

  const handleStateChange = useCallback(
    (e: EventArg<'state', false, { state: NavigationState }>) => {
      const newIndex = e?.data?.state?.index;
      if (typeof newIndex === 'number') {
        if (lastIndexRef.current !== null && lastIndexRef.current !== newIndex) {
          // If the index change was not caused by a recent tab button press,
          // provide a selection tick for page swipe.
          const isFromTap = Date.now() - lastTapTimeRef.current < 400;
          if (!isFromTap && !reduceMotion) {
            Haptics.selectionAsync().catch(() => {});
          }
        }
        lastIndexRef.current = newIndex;
      }
    },
    [reduceMotion]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <LocaleDirContext.Provider value={isRTL ? 'rtl' : 'ltr'}>
        <MaterialTopTabs
          tabBarPosition="bottom"
          tabBar={renderTabBar}
          screenOptions={{
            swipeEnabled: true,
            lazy: true,
            animationEnabled: !reduceMotion,
          }}
          screenListeners={{
            tabPress: handleTabPress,
            state: handleStateChange,
          }}
        >
          <MaterialTopTabs.Screen
            name="index"
            options={{
              title: t('tabs.home'),
              tabBarAccessibilityLabel: t('tabs.home'),
            }}
          />
          <MaterialTopTabs.Screen
            name="transactions"
            options={{
              title: t('tabs.transactions'),
              tabBarAccessibilityLabel: t('tabs.transactions'),
            }}
          />
          <MaterialTopTabs.Screen
            name="clients"
            options={{
              title: t('tabs.clients'),
              tabBarAccessibilityLabel: t('tabs.clients'),
            }}
          />
          <MaterialTopTabs.Screen
            name="more"
            options={{
              title: t('tabs.more'),
              tabBarAccessibilityLabel: t('tabs.more'),
            }}
          />
        </MaterialTopTabs>
      </LocaleDirContext.Provider>
      <TabBarFab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
