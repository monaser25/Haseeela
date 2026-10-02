import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  Repeat,
  FileText,
  Settings as SettingsIcon,
  Bell,
  Languages,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useAuth } from '../../../auth';
import {
  Avatar,
  Card,
  Chevron,
  ListGroup,
  ListRow,
  ScreenContainer,
} from '../../../components/ui';
import { FadeInView, triggerHaptic } from '../../../components/motion';

interface SectionLabelProps {
  title: string;
  color: string;
  typography: object;
}

function SectionLabel({ title, color, typography }: SectionLabelProps) {
  return (
    <Text accessibilityRole="header" style={[typography, styles.sectionLabel, { color }]}>
      {title}
    </Text>
  );
}

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
  const appVersion = Constants.expoConfig?.version;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const labelColor = theme.colors.textSecondary;
  const labelTypography = theme.typography.smallMedium;

  return (
    <ScreenContainer testID="more-tab-screen" edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <FadeInView index={0}>
          <Text
            accessibilityRole="header"
            style={[theme.typography.title, { color: theme.colors.text }]}
          >
            {t('tabs.more')}
          </Text>
        </FadeInView>

        {/* Profile header card - pressable to Profile */}
        <FadeInView index={1}>
          <Card
            variant="gradient"
            padding={20}
            testID="more-profile-card"
            accessibilityLabel={t('more.profile')}
            haptic="selection"
            onPress={() => router.push('/(app)/profile' as any)}
          >
            <View style={styles.profileRow}>
              <Avatar name={displayName} size={60} tone="accent" />
              <View style={styles.profileInfo}>
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={[theme.typography.h1, { color: theme.colors.onHero }]}
                  testID="more-user-name"
                >
                  {displayName}
                </Text>

                {user?.email ? (
                  <Text
                    numberOfLines={1}
                    style={[theme.typography.small, { color: theme.colors.onHeroMuted }]}
                    testID="more-user-email"
                  >
                    {user.email}
                  </Text>
                ) : null}
              </View>

              <Chevron size={20} color={theme.colors.onHero} />
            </View>
          </Card>
        </FadeInView>

        {/* Workspace */}
        <FadeInView index={2}>
          <SectionLabel
            title={t('settings.section.workspace')}
            color={labelColor}
            typography={labelTypography}
          />
          <ListGroup>
            <ListRow
              testID="more-invoices-link"
              icon={FileText}
              iconTone="accent"
              title={t('more.invoices')}
              subtitle={t('more.invoicesDesc')}
              onPress={() => router.push('/(app)/invoices' as any)}
            />
            <ListRow
              testID="more-subscriptions-link"
              icon={Repeat}
              iconTone="positive"
              title={t('more.subscriptions')}
              subtitle={t('more.subscriptionsDesc')}
              onPress={() => router.push('/(app)/subscriptions' as any)}
            />
          </ListGroup>
        </FadeInView>

        {/* Account */}
        <FadeInView index={3}>
          <SectionLabel
            title={t('settings.section.account')}
            color={labelColor}
            typography={labelTypography}
          />
          <ListGroup>
            <ListRow
              testID="more-notifications-link"
              icon={Bell}
              iconTone="info"
              title={t('more.notifications')}
              subtitle={t('more.notificationsDesc')}
              onPress={() => router.push('/(app)/notifications' as any)}
            />
            <ListRow
              testID="more-settings-link"
              icon={SettingsIcon}
              iconTone="neutral"
              title={t('more.settings')}
              subtitle={t('more.settingsDesc')}
              onPress={() => router.push('/(app)/settings' as any)}
            />
          </ListGroup>
        </FadeInView>

        {/* Preferences: inline toggles */}
        <FadeInView index={4}>
          <SectionLabel
            title={t('more.section.preferences')}
            color={labelColor}
            typography={labelTypography}
          />
          <ListGroup>
            <ListRow
              testID="language-toggle"
              icon={Languages}
              iconTone="warning"
              title={t('settings.label.language')}
              accessibilityLabel={t('home.switchLanguageA11y')}
              accessibilityHint={t('home.switchLanguageHint')}
              onPress={toggleLocale}
              trailing={
                <Text style={[theme.typography.smallMedium, { color: theme.colors.accentText }]}>
                  {nextLanguageLabel}
                </Text>
              }
            />
            <ListRow
              testID="theme-toggle"
              icon={isDark ? Moon : Sun}
              iconTone="accent"
              title={t('sidebar.menu.darkMode')}
              accessibilityLabel={
                isDark ? t('home.switchThemeLightA11y') : t('home.switchThemeDarkA11y')
              }
              switchValue={isDark}
              onPress={toggleTheme}
            />
          </ListGroup>
        </FadeInView>

        {/* Danger zone */}
        <FadeInView index={5}>
          <SectionLabel
            title={t('settings.section.danger')}
            color={theme.colors.negativeText}
            typography={labelTypography}
          />
          <ListGroup style={{ borderColor: `${theme.colors.negative}47` }}>
            <ListRow
              testID="sign-out-button"
              icon={LogOut}
              danger
              title={t('settings.action.logout')}
              accessibilityLabel={t('settings.action.logout')}
              disabled={isSigningOut}
              onPress={() => {
                triggerHaptic('warning');
                handleSignOut();
              }}
              trailing={
                isSigningOut ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.negativeText}
                    testID="sign-out-button-loading"
                  />
                ) : undefined
              }
            />
          </ListGroup>
        </FadeInView>

        {appVersion ? (
          <Text
            style={[theme.typography.caption, styles.version, { color: theme.colors.textMuted }]}
            testID="more-app-version"
          >
            {t('more.version', { version: appVersion })}
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    width: '100%',
    paddingBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    marginBottom: 8,
    marginHorizontal: 6,
  },
  version: {
    textAlign: 'center',
    marginTop: 4,
  },
});
