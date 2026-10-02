import React, { useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuth } from '../../auth';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { usePreferences, useOverview } from '../../api';
import { PushRegistrar } from '../../services/push/PushRegistrar';

export function checkNeedsOnboarding(
  prefs: { onboardedAt: string | null } | undefined | null,
  overview: { clients: any[]; subscriptions: any[]; transactions: any[] } | undefined | null
): boolean {
  if (!prefs || !overview) return false;
  return (
    prefs.onboardedAt === null &&
    overview.clients.length === 0 &&
    overview.subscriptions.length === 0 &&
    overview.transactions.length === 0
  );
}

interface OnboardingDecision {
  userId: string;
  needsOnboarding: boolean;
  isInitiallyOnboarded: boolean;
}

export default function AppLayout() {
  const { status, user } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { data: prefs, isLoading: isPrefsLoading } = usePreferences();
  const { data: overview, isLoading: isOverviewLoading } = useOverview();
  const segments = useSegments();

  const decisionRef = useRef<OnboardingDecision | null>(null);

  if (status === 'loading') {
    return null;
  }

  if (status !== 'signedIn') {
    decisionRef.current = null;
    return <Redirect href="/(auth)/login" />;
  }

  const currentUserId = user?.id ?? '__user__';

  if (decisionRef.current && decisionRef.current.userId !== currentUserId) {
    decisionRef.current = null;
  }

  // Gate check: wait while loading preferences or overview if no decision latched yet
  if (!decisionRef.current) {
    if (isPrefsLoading || isOverviewLoading) {
      return (
        <View
          testID="gate-loading-container"
          style={[styles.loadingContainer, { backgroundColor: theme.colors.bg }]}
        >
          <ActivityIndicator
            size="large"
            color={theme.colors.accent}
            accessibilityLabel={t('onboarding.loading')}
          />
        </View>
      );
    }

    // Decide once when prefs and overview first load for this user
    decisionRef.current = {
      userId: currentUserId,
      needsOnboarding: checkNeedsOnboarding(prefs, overview),
      isInitiallyOnboarded: Boolean(prefs?.onboardedAt),
    };
  }

  const isOnboardingRoute = segments.includes('onboarding');
  const isNowOnboarded = Boolean(prefs?.onboardedAt);
  const isAlreadyOnboarded = decisionRef.current.isInitiallyOnboarded || isNowOnboarded;

  // Guard: if already onboarded (initial decision or finished) and on onboarding route, redirect to tabs
  if (isAlreadyOnboarded && isOnboardingRoute) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  // Only ever redirect INTO onboarding for users needing onboarding who haven't completed it yet
  if (decisionRef.current.needsOnboarding && !isNowOnboarded && !isOnboardingRoute) {
    return <Redirect href="/(app)/onboarding" />;
  }

  return (
    <>
      <PushRegistrar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="transaction/new"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="client/new"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="client/[id]"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="subscriptions"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="subscription/new"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="subscription/[id]"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="invoices"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="invoice/new"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="invoice/[id]"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="profile"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="notifications"
          options={{ presentation: 'card' }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
