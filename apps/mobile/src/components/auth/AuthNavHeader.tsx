import React from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Globe, Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface AuthNavHeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showLanguageToggle?: boolean;
  showThemeToggle?: boolean;
}

export function AuthNavHeader({
  showBack = false,
  onBack,
  showLanguageToggle = true,
  showThemeToggle = true,
}: AuthNavHeaderProps) {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useTheme();
  const { t, locale, toggleLocale } = useI18n();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const nextLanguage = locale === 'ar' ? 'English' : 'العربية';

  return (
    <View style={styles.container}>
      <View style={styles.sideSlot}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="auth-back-button"
          >
            <ChevronLeft
              size={20}
              color={theme.colors.text}
              style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionsSlot}>
        {showLanguageToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.switchLanguageA11y')}
            accessibilityHint={t('home.switchLanguageHint')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={toggleLocale}
            style={({ pressed }) => [
              styles.langButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="auth-language-toggle"
          >
            <Globe size={16} color={theme.colors.accent} />
            <Text
              style={[
                theme.typography.smallMedium,
                { color: theme.colors.text },
              ]}
            >
              {nextLanguage}
            </Text>
          </Pressable>
        ) : null}

        {showThemeToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isDark ? t('home.switchThemeLightA11y') : t('home.switchThemeDarkA11y')
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={toggleTheme}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="auth-theme-toggle"
          >
            {isDark ? (
              <Sun size={18} color={theme.colors.warning} />
            ) : (
              <Moon size={18} color={theme.colors.textSecondary} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sideSlot: {
    minWidth: 44,
    justifyContent: 'center',
  },
  actionsSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
