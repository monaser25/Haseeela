import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { Repeat, ChevronRight, FileText, Settings as SettingsIcon, Bell } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useAuth } from '../../../auth';
import { Button, ScreenContainer } from '../../../components/ui';

export default function MoreScreen() {
  const router = useRouter();
  const { theme, toggleTheme, isDark } = useTheme();
  const { t, toggleLocale } = useI18n();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName =
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    t('onboarding.welcome.fallback_name');

  const nextLanguageLabel = t('home.nextLanguage');
  const themeLabel = isDark ? t('home.themeLight') : t('home.themeDark');

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ScreenContainer testID="more-tab-screen" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* User Profile Card - Pressable to Profile */}
          <Pressable
            testID="more-profile-card"
            accessibilityRole="button"
            accessibilityLabel={t('more.profile')}
            onPress={() => router.push('/(app)/profile' as any)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileInfo}>
                <Text
                  accessibilityRole="header"
                  style={[theme.typography.h1, styles.nameText, { color: theme.colors.text }]}
                  testID="more-user-name"
                >
                  {displayName}
                </Text>

                {user?.email ? (
                  <Text
                    style={[
                      theme.typography.body,
                      styles.emailText,
                      { color: theme.colors.textSecondary },
                    ]}
                    testID="more-user-email"
                  >
                    {user.email}
                  </Text>
                ) : null}
              </View>

              <ChevronRight
                size={20}
                color={theme.colors.textMuted}
                style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </View>
          </Pressable>

          {/* Navigation Links Group */}
          <View style={styles.linksGroup}>
            {/* Invoices Navigation Link */}
            <Pressable
              testID="more-invoices-link"
              accessibilityRole="button"
              accessibilityLabel={t('more.invoices')}
              onPress={() => router.push('/(app)/invoices' as any)}
              style={({ pressed }) => [
                styles.linkCard,
                {
                  backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <View style={[styles.linkIcon, { backgroundColor: theme.colors.accentTint }]}>
                <FileText size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.linkTextContainer}>
                <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                  {t('more.invoices')}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {t('more.invoicesDesc')}
                </Text>
              </View>
              <ChevronRight
                size={18}
                color={theme.colors.textMuted}
                style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </Pressable>

            {/* Subscriptions Navigation Link */}
            <Pressable
              testID="more-subscriptions-link"
              accessibilityRole="button"
              accessibilityLabel={t('more.subscriptions')}
              onPress={() => router.push('/(app)/subscriptions' as any)}
              style={({ pressed }) => [
                styles.linkCard,
                {
                  backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <View style={[styles.linkIcon, { backgroundColor: theme.colors.accentTint }]}>
                <Repeat size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.linkTextContainer}>
                <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                  {t('more.subscriptions')}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {t('more.subscriptionsDesc')}
                </Text>
              </View>
              <ChevronRight
                size={18}
                color={theme.colors.textMuted}
                style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </Pressable>

            {/* Notifications Navigation Link */}
            <Pressable
              testID="more-notifications-link"
              accessibilityRole="button"
              accessibilityLabel={t('more.notifications')}
              onPress={() => router.push('/(app)/notifications' as any)}
              style={({ pressed }) => [
                styles.linkCard,
                {
                  backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <View style={[styles.linkIcon, { backgroundColor: theme.colors.infoTint }]}>
                <Bell size={20} color={theme.colors.info} />
              </View>
              <View style={styles.linkTextContainer}>
                <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                  {t('more.notifications')}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {t('more.notificationsDesc')}
                </Text>
              </View>
              <ChevronRight
                size={18}
                color={theme.colors.textMuted}
                style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </Pressable>

            {/* Settings Navigation Link */}
            <Pressable
              testID="more-settings-link"
              accessibilityRole="button"
              accessibilityLabel={t('more.settings')}
              onPress={() => router.push('/(app)/settings' as any)}
              style={({ pressed }) => [
                styles.linkCard,
                {
                  backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <View style={[styles.linkIcon, { backgroundColor: theme.colors.accentTint }]}>
                <SettingsIcon size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.linkTextContainer}>
                <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                  {t('more.settings')}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {t('more.settingsDesc')}
                </Text>
              </View>
              <ChevronRight
                size={18}
                color={theme.colors.textMuted}
                style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
              />
            </Pressable>
          </View>

          {/* Preferences / Actions */}
          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={toggleLocale}
              accessibilityLabel={t('home.switchLanguageA11y')}
              accessibilityHint={t('home.switchLanguageHint')}
              testID="language-toggle"
            >
              {nextLanguageLabel}
            </Button>

            <Button
              variant="secondary"
              onPress={toggleTheme}
              accessibilityLabel={
                isDark ? t('home.switchThemeLightA11y') : t('home.switchThemeDarkA11y')
              }
              testID="theme-toggle"
            >
              {themeLabel}
            </Button>

            <Button
              variant="secondary"
              onPress={handleSignOut}
              loading={isSigningOut}
              testID="sign-out-button"
              accessibilityLabel={t('settings.action.logout')}
            >
              {t('settings.action.logout')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  container: {
    gap: 16,
    width: '100%',
  },
  card: {
    padding: 20,
    borderWidth: 1,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flex: 1,
  },
  nameText: {
    marginBottom: 4,
  },
  emailText: {
    marginBottom: 0,
  },
  linksGroup: {
    gap: 10,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    minHeight: 56,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
  },
  linkTextContainer: {
    flex: 1,
    marginEnd: 8,
  },
  actions: {
    gap: 12,
  },
});
