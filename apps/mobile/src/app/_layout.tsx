import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Locale } from '@haseela/shared';
import { ThemeProvider, useTheme } from '../theme';
import { CoverTransitionProvider } from '../components/motion/TransitionCover';
import { I18nProvider, LayoutDirectionRoot, initLocale } from '../i18n';
import { QueryProvider } from '../query';
import { AuthProvider, useAuth } from '../auth';
import { PushNavigationHandler } from '../services/push/PushNavigationHandler';
import { ForceUpdateGate } from '../services/update/ForceUpdateGate';

// Keep native splash screen visible until initialization completes
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Longest the native splash screen may stay up. Locale init, the auth bootstrap or a slow native
 * module can stall; past this the splash is hidden anyway and a visible fallback is rendered, so a
 * cold start can never hang silently on the splash.
 */
export const SPLASH_FAILSAFE_MS = 5000;

export function RootContent({ isLocaleReady }: { isLocaleReady: boolean }) {
  const { theme, isDark } = useTheme();
  const { status } = useAuth();
  const [bootStalled, setBootStalled] = useState(false);

  const isBootReady = isLocaleReady && status !== 'loading';

  useEffect(() => {
    if (isBootReady) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setBootStalled(true);
    }, SPLASH_FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [isBootReady]);

  if (!isBootReady) {
    if (!bootStalled) return null;
    return (
      <View
        testID="boot-fallback"
        style={[styles.bootFallback, { backgroundColor: theme.colors.bg }]}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Inside the theme so the language-switch transition can dip through the current background. */
function LocalizedProviders({
  initialLocale,
  children,
}: {
  initialLocale: Locale | null;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <I18nProvider initialLocale={initialLocale ?? undefined} coverColor={theme.colors.bg}>
      <LayoutDirectionRoot>{children}</LayoutDirectionRoot>
    </I18nProvider>
  );
}

export default function RootLayout() {
  const [initialLocale, setInitialLocale] = useState<Locale | null>(null);

  useEffect(() => {
    // initLocale is bounded and never rejects; the catch is a last-resort guard for the boot gate.
    initLocale()
      .then((resolvedLocale) => {
        setInitialLocale(resolvedLocale);
      })
      .catch(() => {
        setInitialLocale('en');
      });
  }, []);

  return (
    <SafeAreaProvider>
      <CoverTransitionProvider>
        <ThemeProvider>
          <LocalizedProviders initialLocale={initialLocale}>
            <QueryProvider>
              <AuthProvider>
                <ForceUpdateGate>
                  <PushNavigationHandler />
                  <RootContent isLocaleReady={initialLocale !== null} />
                </ForceUpdateGate>
              </AuthProvider>
            </QueryProvider>
          </LocalizedProviders>
        </ThemeProvider>
      </CoverTransitionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
