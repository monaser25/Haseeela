import React, { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button } from '../../components/ui';
import { ANDROID_STORE_URL, getIosStoreUrl } from './minVersion';

/** Full-screen, non-dismissible screen shown when this build is below the server's minimum version. */
export function UpdateRequiredScreen() {
  const { theme } = useTheme();
  const { t, isRTL } = useI18n();
  const [openFailed, setOpenFailed] = useState(false);

  const storeUrl = Platform.OS === 'ios' ? getIosStoreUrl() : ANDROID_STORE_URL;

  // The gate replaces the normal root, which is what normally hides the native splash screen.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const openStore = async () => {
    if (!storeUrl) return;
    setOpenFailed(false);
    try {
      await Linking.openURL(storeUrl);
    } catch {
      setOpenFailed(true);
    }
  };

  const direction = { writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const) };

  return (
    <SafeAreaView
      testID="update-required-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
    >
      <View style={styles.content}>
        <Text
          accessibilityRole="header"
          style={[theme.typography.h1, styles.text, direction, { color: theme.colors.text }]}
        >
          {t('update.required.title')}
        </Text>
        <Text
          style={[theme.typography.body, styles.text, direction, { color: theme.colors.textMuted }]}
        >
          {t('update.required.body')}
        </Text>
        {openFailed ? (
          <Text
            testID="update-required-open-failed"
            accessibilityRole="alert"
            style={[theme.typography.body, styles.text, direction, { color: theme.colors.text }]}
          >
            {t('update.required.openFailed')}
          </Text>
        ) : null}
        {storeUrl ? (
          <Button testID="update-required-button" onPress={openStore}>
            {t('update.required.button')}
          </Button>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
