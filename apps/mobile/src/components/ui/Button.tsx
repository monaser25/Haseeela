import React from 'react';
import {
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, gradientDirection } from '../../theme';
import { PressableScale } from '../motion';

export type ButtonVariant = 'primary' | 'secondary' | 'link' | 'destructive';

export interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { theme } = useTheme();

  const isDisabled = disabled || loading;

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isLink = variant === 'link';
  const isDestructive = variant === 'destructive';

  const backgroundColor = isPrimary
    ? theme.colors.accent
    : isSecondary
      ? theme.colors.surface
      : isDestructive
        ? theme.colors.negativeTint
        : 'transparent';

  const borderColor = isSecondary
    ? theme.colors.border
    : isDestructive
      ? theme.colors.negative
      : 'transparent';
  const borderWidth = isSecondary || isDestructive ? 1 : 0;

  const textColor = isPrimary
    ? theme.colors.accentFg
    : isSecondary
      ? theme.colors.text
      : isDestructive
        ? theme.colors.negativeText
        : theme.colors.accentText;

  const indicatorColor = isPrimary
    ? theme.colors.accentFg
    : isDestructive
      ? theme.colors.negativeText
      : theme.colors.accentText;

  const isIconRight = iconPosition === 'right';

  const iconElement = loading ? (
    <ActivityIndicator
      size="small"
      color={indicatorColor}
      style={isIconRight ? styles.spinnerEnd : styles.spinnerStart}
      testID={testID ? `${testID}-loading` : 'button-loading'}
    />
  ) : icon ? (
    <View style={styles.iconContainer}>{icon}</View>
  ) : null;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel || (typeof children === 'string' ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      haptic={isLink ? false : 'light'}
      scaleTo={isLink ? 0.98 : undefined}
      restOpacity={isDisabled ? 0.55 : 1}
      style={[
        styles.base,
        isLink ? styles.linkBase : styles.standardBase,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          borderRadius: isLink ? theme.radius.sm : theme.radius.lg,
        },
        isPrimary && !isDisabled ? theme.shadows.md : null,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={theme.gradients.accent}
          start={gradientDirection.diagonal.start}
          end={gradientDirection.diagonal.end}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.lg }]}
        />
      ) : null}

      <View style={styles.contentRow}>
        {!isIconRight ? iconElement : null}

        {typeof children === 'string' ? (
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.text,
              { color: textColor },
              textStyle,
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}

        {isIconRight ? iconElement : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardBase: {
    minHeight: 52, // >= 44pt touch target
    paddingHorizontal: 22,
    paddingVertical: 14,
    width: '100%',
  },
  linkBase: {
    minHeight: 44, // >= 44pt touch target
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerStart: {
    marginEnd: 4,
  },
  spinnerEnd: {
    marginStart: 4,
  },
  text: {
    textAlign: 'center',
  },
});
