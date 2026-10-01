import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Locale } from '@haseela/shared';
import { ThemeProvider, useTheme } from '../theme';
import { I18nProvider, initLocale } from '../i18n';
import { QueryProvider } from '../query';
import { AuthProvider, useAuth } from '../auth';

// Keep native splash screen visible until initialization completes
SplashScreen.preventAutoHideAsync().catch(() => {});

export function RootContent({ isLocaleReady }: { isLocaleReady: boolean }) {
  const { theme, isDark } = useTheme();
  const { status } = useAuth();

  useEffect(() => {
    if (isLocaleReady && status !== 'loading') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLocaleReady, status]);

  if (!isLocaleReady || status === 'loading') {
    return null;
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

export default function RootLayout() {
  const [initialLocale, setInitialLocale] = useState<Locale | null>(null);

  useEffect(() => {
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
      <ThemeProvider>
        <I18nProvider initialLocale={initialLocale ?? undefined}>
          <QueryProvider>
            <AuthProvider>
              <RootContent isLocaleReady={initialLocale !== null} />
            </AuthProvider>
          </QueryProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
