import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { TabBarFab } from '../../../components/navigation/TabBarFab';
import { FloatingTabBar, FloatingTabBarProps } from '../../../components/navigation/FloatingTabBar';

function renderTabBar(props: unknown) {
  return <FloatingTabBar {...(props as FloatingTabBarProps)} />;
}

export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
