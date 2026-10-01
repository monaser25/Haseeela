import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../auth';
import {
  isAuthEmailRateLimited,
  setAuthEmailCooldown,
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
  PasswordStrength,
  ScreenContainer,
} from '../../components/ui';
import { AuthNavHeader } from '../../components/auth/AuthNavHeader';
import { AuthHeader } from '../../components/auth/AuthHeader';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const validateName = (val: string): boolean => {
    if (!val.trim()) {
      setNameError(t('auth.validation.nameRequired'));
      return false;
    }
    setNameError(null);
    return true;
  };

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

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError(t('auth.validation.passwordRequired'));
      return false;
    }
    if (val.length < 8) {
      setPasswordError(t('auth.validation.passwordMinLength'));
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const handleRegister = async () => {
    setErrorBanner(null);

    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isNameValid || !isEmailValid || !isPasswordValid) {
      return;
    }

    if (!isOnline) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email.trim(), password, name.trim());
      // Navigate to check-email screen with the email param
      router.push({
        pathname: '/(auth)/check-email',
        params: { email: email.trim() },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.register.error.default');
      if (isAuthEmailRateLimited(message)) {
        setAuthEmailCooldown(email, AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      setErrorBanner(getAuthErrorMessage(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer
      testID="register-screen"
      header={
        <AuthNavHeader
          showBack
          onBack={() => router.replace('/(auth)/login')}
        />
      }
    >
      <AuthHeader
        brandName={t('brand.name')}
        title={t('auth.register.title')}
        sub={t('auth.register.subtitle')}
      />

      {errorBanner ? (
        <Banner
          tone="error"
          title={t('auth.register.alert.error_title')}
          message={errorBanner}
          testID="register-error-banner"
        />
      ) : null}

      <TextField
        label={t('auth.register.label.name')}
        placeholder={t('auth.register.placeholder.name')}
        value={name}
        onChangeText={(val) => {
          setName(val);
          if (nameError) validateName(val);
        }}
        onBlur={() => validateName(name)}
        error={nameError}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailInputRef.current?.focus()}
        testID="register-name-input"
      />

      <TextField
        ref={emailInputRef}
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
        testID="register-email-input"
      />

      <TextField
        ref={passwordInputRef}
        label={t('auth.login.label.password')}
        hint={t('auth.register.hint.password')}
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          if (passwordError) validatePassword(val);
        }}
        onBlur={() => validatePassword(password)}
        error={passwordError}
        isPassword
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleRegister}
        testID="register-password-input"
      />

      {password ? (
        <PasswordStrength
          password={password}
          testID="register-password-strength"
        />
      ) : null}

      <Button
        variant="primary"
        onPress={handleRegister}
        loading={isSubmitting}
        disabled={!isOnline || isSubmitting}
        testID="register-submit-button"
        style={styles.submitButton}
      >
        {isSubmitting
          ? t('auth.register.action.creating')
          : t('auth.register.action.create')}
      </Button>

      <View style={styles.loginPromptRow}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary },
          ]}
        >
          {t('auth.register.text.already_have')}{' '}
        </Text>
        <Link href="/(auth)/login" asChild>
          <Button
            variant="link"
            testID="register-login-link"
            textStyle={{ color: theme.colors.accent }}
          >
            {t('auth.login.action.login')}
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
  loginPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
});
