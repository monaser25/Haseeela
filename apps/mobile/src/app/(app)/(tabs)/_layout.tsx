import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Receipt, Users, Menu } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { TabBarFab } from '../../../components/navigation/TabBarFab';

export default function TabLayout() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const bottomInset = Math.max(insets.bottom, 6);
  const tabHeight = 56 + bottomInset;

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomInset,
            paddingTop: 6,
            elevation: 0,
          },
          tabBarItemStyle: {
            minHeight: 44,
            minWidth: 44,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: focused ? '700' : '500',
                  },
                ]}
              >
                {t('tabs.home')}
              </Text>
            ),
            tabBarIcon: ({ focused, color, size }) => (
              <View style={styles.iconContainer}>
                <Home
                  size={size ?? 22}
                  color={color}
                  strokeWidth={focused ? 2.5 : 1.75}
                />
                {focused && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  />
                )}
              </View>
            ),
            tabBarAccessibilityLabel: t('tabs.home'),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: t('tabs.transactions'),
            tabBarItemStyle: {
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginEnd: 16,
            },
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: focused ? '700' : '500',
                  },
                ]}
              >
                {t('tabs.transactions')}
              </Text>
            ),
            tabBarIcon: ({ focused, color, size }) => (
              <View style={styles.iconContainer}>
                <Receipt
                  size={size ?? 22}
                  color={color}
                  strokeWidth={focused ? 2.5 : 1.75}
                />
                {focused && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  />
                )}
              </View>
            ),
            tabBarAccessibilityLabel: t('tabs.transactions'),
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: t('tabs.clients'),
            tabBarItemStyle: {
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginStart: 16,
            },
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: focused ? '700' : '500',
                  },
                ]}
              >
                {t('tabs.clients')}
              </Text>
            ),
            tabBarIcon: ({ focused, color, size }) => (
              <View style={styles.iconContainer}>
                <Users
                  size={size ?? 22}
                  color={color}
                  strokeWidth={focused ? 2.5 : 1.75}
                />
                {focused && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  />
                )}
              </View>
            ),
            tabBarAccessibilityLabel: t('tabs.clients'),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('tabs.more'),
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: focused ? '700' : '500',
                  },
                ]}
              >
                {t('tabs.more')}
              </Text>
            ),
            tabBarIcon: ({ focused, color, size }) => (
              <View style={styles.iconContainer}>
                <Menu
                  size={size ?? 22}
                  color={color}
                  strokeWidth={focused ? 2.5 : 1.75}
                />
                {focused && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  />
                )}
              </View>
            ),
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
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 28,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
