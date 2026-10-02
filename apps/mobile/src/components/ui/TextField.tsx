import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface TextFieldProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  hint?: string;
  error?: string | null;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    isPassword = false,
    containerStyle,
    testID,
    onFocus,
    onBlur,
    style,
    editable = true,
    ...rest
  },
  ref
) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasError = Boolean(error);

  const borderColor = hasError
    ? theme.colors.negative
    : isFocused
      ? theme.colors.accent
      : theme.colors.border;

  const togglePasswordLabel = showPassword
    ? t('auth.password.hide')
    : t('auth.password.show');

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={[
            theme.typography.smallMedium,
            styles.label,
            {
              color: hasError ? theme.colors.negativeText : theme.colors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceHover,
            borderColor,
            borderRadius: theme.radius.md,
            borderWidth: isFocused ? 1.5 : 1,
          },
        ]}
      >
        <TextInput
          ref={ref}
          testID={testID}
          style={[
            theme.typography.body,
            styles.input,
            {
              color: theme.colors.text,
            },
            isPassword ? styles.passwordInputPadding : null,
            style,
          ]}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          editable={editable}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          aria-invalid={hasError}
          {...rest}
        />

        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={togglePasswordLabel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [
              styles.eyeButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => setShowPassword((prev) => !prev)}
            testID={testID ? `${testID}-toggle-password` : 'toggle-password'}
          >
            {showPassword ? (
              <EyeOff size={20} color={theme.colors.textMuted} />
            ) : (
              <Eye size={20} color={theme.colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            theme.typography.small,
            styles.errorText,
            {
              color: theme.colors.negativeText,
            },
          ]}
          testID={testID ? `${testID}-error` : 'textfield-error'}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={[
            theme.typography.small,
            styles.hintText,
            {
              color: theme.colors.textMuted,
            },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  inputWrapper: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
  },
  passwordInputPadding: {
    paddingEnd: 8,
  },
  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 6,
  },
  hintText: {
    marginTop: 6,
  },
});
