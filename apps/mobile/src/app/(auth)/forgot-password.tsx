import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
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
import {
  TextField,
  Button,
  Banner,
  ScreenContainer,
} from '../../components/ui';
import { AuthNavHeader } from '../../components/auth/AuthNavHeader';
import { AuthHeader } from '../../components/auth/AuthHeader';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (!sentTo) {
      setWaitSeconds((prev) => (prev !== 0 ? 0 : prev));
      return;
    }

    const updateCooldown = () => {
      setWaitSeconds(getAuthEmailCooldownSeconds(sentTo));
    };

    updateCooldown();
    const intervalId = setInterval(updateCooldown, 1000);
    return () => clearInterval(intervalId);
  }, [sentTo]);

  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError(t('auth.validation.emailRequired'));
      return false;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError(t('auth.validation.emailInvalid'));
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleSubmit = async () => {
    setErrorBanner(null);

    const isEmailValid = validateEmail(email);
    if (!isEmailValid) {
      return;
    }

    if (!isOnline) {
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(email.trim());
      setAuthEmailCooldown(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.forgotPassword.defaultError');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(email.trim(), AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
        setErrorBanner(getAuthErrorMessage(message));
      } else {
        // Consistent with web: treat neutral to prevent account enumeration
        setSentTo(email.trim());
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!sentTo || waitSeconds > 0 || isSubmitting || !isOnline) return;

    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      await resetPassword(sentTo);
      setAuthEmailCooldown(sentTo);
      setWaitSeconds(getAuthEmailCooldownSeconds(sentTo));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.forgotPassword.defaultError');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(sentTo, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setErrorBanner(getAuthErrorMessage(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sentTo) {
    return (
      <ScreenContainer
        testID="forgot-password-success-screen"
        header={
          <AuthNavHeader
            showBack
            onBack={() => setSentTo(null)}
          />
        }
      >
        <View style={styles.successWrapper}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: theme.colors.positiveTint,
              },
            ]}
          >
            <MailCheck size={32} color={theme.colors.positiveText} />
          </View>

          <AuthHeader
            title={t('auth.forgotPassword.successTitle')}
            sub={t('auth.forgotPassword.successSubtitle')}
          />

          {errorBanner ? (
            <Banner
              tone="error"
              title={t('auth.forgotPassword.errorTitle')}
              message={errorBanner}
              testID="forgot-password-error-banner"
            />
          ) : null}

          <Button
            variant="secondary"
            onPress={handleResend}
            loading={isSubmitting}
            disabled={waitSeconds > 0 || isSubmitting || !isOnline}
            testID="forgot-password-resend-button"
            style={styles.resendButton}
          >
            {waitSeconds > 0
              ? t('auth.forgotPassword.resendAvailableIn', {
                  time: formatAuthWaitTime(waitSeconds),
                })
              : t('auth.forgotPassword.resendButton')}
          </Button>

          <View style={styles.backToLoginRow}>
            <Link href="/(auth)/login" asChild>
              <Button
                variant="link"
                testID="forgot-password-back-login-link"
                textStyle={{ color: theme.colors.accent }}
              >
                {t('auth.forgotPassword.backToLoginLink')}
              </Button>
            </Link>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      testID="forgot-password-screen"
      header={
        <AuthNavHeader
          showBack
          onBack={() => router.replace('/(auth)/login')}
        />
      }
    >
      <AuthHeader
        brandName={t('brand.name')}
        title={t('auth.forgotPassword.title')}
        sub={t('auth.forgotPassword.subtitle')}
      />

      {errorBanner ? (
        <Banner
          tone="error"
          title={t('auth.forgotPassword.errorTitle')}
          message={errorBanner}
          testID="forgot-password-error-banner"
        />
      ) : null}

      <TextField
        label={t('auth.forgotPassword.emailLabel')}
        placeholder={t('auth.forgotPassword.emailPlaceholder')}
        value={email}
        onChangeText={(val) => {
          setEmail(val);
          if (emailError) validateEmail(val);
        }}
        onBlur={() => validateEmail(email)}
        error={emailError}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        testID="forgot-password-email-input"
      />

      <Button
        variant="primary"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!isOnline || isSubmitting}
        testID="forgot-password-submit-button"
        style={styles.submitButton}
      >
        {isSubmitting
          ? t('auth.forgotPassword.submitButtonLoading')
          : t('auth.forgotPassword.submitButton')}
      </Button>

      <View style={styles.backToLoginRow}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary },
          ]}
        >
          {t('auth.forgotPassword.backToLoginPrompt')}
        </Text>
        <Link href="/(auth)/login" asChild>
          <Button
            variant="link"
            testID="forgot-password-back-login-link"
            textStyle={{ color: theme.colors.accent }}
          >
            {t('auth.forgotPassword.backToLoginLink')}
          </Button>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  submitButton: {
    marginTop: 8,
  },
  resendButton: {
    marginTop: 16,
    width: '100%',
  },
  successWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  backToLoginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
});
