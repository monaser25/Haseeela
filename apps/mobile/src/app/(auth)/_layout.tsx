import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../auth';
import { useTheme } from '../../theme';

export default function AuthLayout() {
  const { status } = useAuth();
  const { theme } = useTheme();

  if (status === 'loading') {
    return null;
  }

  if (status === 'signedIn') {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="check-email" />
    </Stack>
  );
}
