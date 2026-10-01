import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { useAuth } from '../../auth';
import {
  isEmailNotConfirmed,
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

export default function LoginScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    confirmed?: string;
    reset?: string;
    expired?: string;
  }>();
  const { signIn, resendConfirmation } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendWaitSeconds, setResendWaitSeconds] = useState(0);

  const passwordInputRef = useRef<TextInput>(null);

  // Handle URL search params on mount
  useEffect(() => {
    if (searchParams.confirmed === '1') {
      setNoticeBanner(t('auth.login.notice.email_confirmed'));
    } else if (searchParams.reset === '1') {
      setNoticeBanner(t('auth.login.notice.password_updated'));
    } else if (searchParams.expired === '1') {
      setNoticeBanner(t('auth.login.notice.session_expired'));
    }
  }, [searchParams.confirmed, searchParams.reset, searchParams.expired, t]);

  // Handle cooldown interval
  useEffect(() => {
    if (!unconfirmedEmail) return;

    const updateCooldown = () => {
      setResendWaitSeconds(getAuthEmailCooldownSeconds(unconfirmedEmail));
    };

    updateCooldown();
    const intervalId = setInterval(updateCooldown, 1000);
    return () => clearInterval(intervalId);
  }, [unconfirmedEmail]);

  const validateEmail = (value: string): boolean => {
    const trimmed = value.trim();
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

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError(t('auth.validation.passwordRequired'));
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const handleLogin = async () => {
    setErrorBanner(null);
    setNoticeBanner(null);
    setUnconfirmedEmail(null);

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    if (!isOnline) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      // Navigation is handled automatically by the auth state change / route guard
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.login.error.default');
      const emailRateLimited = isAuthEmailRateLimited(message);
      const emailNotConfirmed = isEmailNotConfirmed(message);

      if (emailRateLimited) {
        setAuthEmailCooldown(email, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
        setUnconfirmedEmail(email);
      }

      if (emailNotConfirmed) {
        setUnconfirmedEmail(email);
        setErrorBanner(t('auth.login.error.email_not_confirmed'));
      } else {
        setErrorBanner(getAuthErrorMessage(message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail || isResending || resendWaitSeconds > 0 || !isOnline) {
      return;
    }

    setIsResending(true);
    setErrorBanner(null);

    try {
      await resendConfirmation(unconfirmedEmail);
      setAuthEmailCooldown(unconfirmedEmail);
      setNoticeBanner(t('auth.login.notice.resend_success', { email: unconfirmedEmail }));
      setUnconfirmedEmail(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.login.error.resend_failed');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(unconfirmedEmail, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setErrorBanner(getAuthErrorMessage(message));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ScreenContainer
      testID="login-screen"
      header={<AuthNavHeader showBack={false} />}
    >
      <AuthHeader
        brandName={t('brand.name')}
        title={t('auth.login.title')}
        sub={t('auth.login.subtitle')}
      />

      {/* Notice Banner */}
      {noticeBanner ? (
        <Banner
          tone="notice"
          title={t('auth.login.alert.notice_title')}
          message={noticeBanner}
          testID="login-notice-banner"
        />
      ) : null}

      {/* Error / Email Unconfirmed Banner */}
      {errorBanner ? (
        <Banner
          tone={unconfirmedEmail ? 'warning' : 'error'}
          title={
            unconfirmedEmail
              ? t('auth.login.alert.confirm_title')
              : t('auth.login.alert.error_title')
          }
          message={errorBanner}
          testID="login-error-banner"
        >
          {unconfirmedEmail ? (
            <Button
              variant="secondary"
              onPress={handleResendConfirmation}
              loading={isResending}
              disabled={resendWaitSeconds > 0 || !isOnline || isResending}
              testID="login-resend-button"
              style={styles.resendButton}
            >
              {isResending
                ? t('auth.login.action.sending')
                : resendWaitSeconds > 0
                  ? t('auth.login.action.resend_in', {
                      time: formatAuthWaitTime(resendWaitSeconds),
                    })
                  : t('auth.login.action.resend')}
            </Button>
          ) : null}
        </Banner>
      ) : null}

      {/* Form Fields */}
      <TextField
        label={t('auth.login.label.email')}
        placeholder={t('auth.login.placeholder.email')}
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
        returnKeyType="next"
        onSubmitEditing={() => passwordInputRef.current?.focus()}
        testID="login-email-input"
      />

      <TextField
        ref={passwordInputRef}
        label={t('auth.login.label.password')}
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          if (passwordError) validatePassword(val);
        }}
        onBlur={() => validatePassword(password)}
        error={passwordError}
        isPassword
        autoComplete="password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleLogin}
        testID="login-password-input"
      />

      {/* Forgot Password Link */}
      <View style={styles.forgotContainer}>
        <Link href="/(auth)/forgot-password" asChild>
          <Button
            variant="link"
            testID="login-forgot-password-link"
            textStyle={{ color: theme.colors.accent }}
          >
            {t('auth.login.action.forgot_password')}
          </Button>
        </Link>
      </View>

      {/* Submit Button */}
      <Button
        variant="primary"
        onPress={handleLogin}
        loading={isSubmitting}
        disabled={!isOnline || isSubmitting}
        testID="login-submit-button"
        style={styles.submitButton}
      >
        {isSubmitting ? t('auth.login.action.logging_in') : t('auth.login.action.login')}
      </Button>

      {/* Create Account Prompt */}
      <View style={styles.createAccountRow}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary },
          ]}
        >
          {t('auth.login.text.new_to')}{' '}
        </Text>
        <Link href="/(auth)/register" asChild>
          <Button
            variant="link"
            testID="login-create-account-link"
            textStyle={{ color: theme.colors.accent }}
          >
            {t('auth.login.action.create_account')}
          </Button>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  resendButton: {
    marginTop: 8,
  },
  forgotContainer: {
    marginTop: -8,
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  submitButton: {
    marginTop: 8,
  },
  createAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
});
