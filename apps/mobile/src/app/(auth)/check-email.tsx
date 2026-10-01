import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useAuth } from '../../auth';
import {
  isAuthEmailRateLimited,
  setAuthEmailCooldown,
  getAuthEmailCooldownSeconds,
  formatAuthWaitTime,
  getAuthErrorMessage,
  AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS,
} from '../../auth/authRateLimit';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useIsOnline } from '../../query/useIsOnline';
import { Button, Banner, ScreenContainer } from '../../components/ui';
import { AuthNavHeader } from '../../components/auth/AuthNavHeader';
import { AuthHeader } from '../../components/auth/AuthHeader';

export default function CheckEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email || '';

  const { resendConfirmation } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendWaitSeconds, setResendWaitSeconds] = useState(0);

  useEffect(() => {
    if (!email) return;

    const updateCooldown = () => {
      setResendWaitSeconds(getAuthEmailCooldownSeconds(email));
    };

    updateCooldown();
    const intervalId = setInterval(updateCooldown, 1000);
    return () => clearInterval(intervalId);
  }, [email]);

  const handleResend = async () => {
    if (!email || isResending || resendWaitSeconds > 0 || !isOnline) {
      return;
    }

    setIsResending(true);
    setErrorBanner(null);
    setNoticeBanner(null);

    try {
      await resendConfirmation(email);
      setAuthEmailCooldown(email);
      setResendWaitSeconds(getAuthEmailCooldownSeconds(email));
      setNoticeBanner(t('auth.login.notice.resend_success', { email }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.login.error.resend_failed');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(email, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setErrorBanner(getAuthErrorMessage(message));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ScreenContainer
      testID="check-email-screen"
      header={
        <AuthNavHeader
          showBack
          onBack={() => router.replace('/(auth)/login')}
        />
      }
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.colors.accentTint },
          ]}
        >
          <Mail size={36} color={theme.colors.accent} />
        </View>

        <AuthHeader
          title={t('auth.register.success.title')}
          sub={t('auth.register.success.subtitle')}
        />

        {email ? (
          <View
            style={[
              styles.emailBadge,
              {
                backgroundColor: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.bodySemiBold,
                { color: theme.colors.text },
              ]}
              testID="check-email-target-address"
            >
              {email}
            </Text>
          </View>
        ) : null}

        {noticeBanner ? (
          <Banner
            tone="success"
            title={t('auth.login.alert.notice_title')}
            message={noticeBanner}
            testID="check-email-notice-banner"
          />
        ) : null}

        {errorBanner ? (
          <Banner
            tone="error"
            title={t('auth.login.alert.error_title')}
            message={errorBanner}
            testID="check-email-error-banner"
          />
        ) : null}

        <Button
          variant="secondary"
          onPress={handleResend}
          loading={isResending}
          disabled={resendWaitSeconds > 0 || isResending || !isOnline}
          testID="check-email-resend-button"
          style={styles.actionButton}
        >
          {isResending
            ? t('auth.login.action.sending')
            : resendWaitSeconds > 0
              ? t('auth.login.action.resend_in', {
                  time: formatAuthWaitTime(resendWaitSeconds),
                })
              : t('auth.login.action.resend')}
        </Button>

        <Link href="/(auth)/login" asChild>
          <Button
            variant="link"
            testID="check-email-return-login-button"
            style={styles.returnButton}
            textStyle={{ color: theme.colors.accent }}
          >
            {t('auth.register.success.return_login')}
          </Button>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emailBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  actionButton: {
    marginTop: 12,
    width: '100%',
  },
  returnButton: {
    marginTop: 16,
  },
});
