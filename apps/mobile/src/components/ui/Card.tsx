import React from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, gradientDirection } from '../../theme';
import { PressableScale, PressableScaleProps } from '../motion';

export type CardVariant = 'default' | 'gradient' | 'tinted';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  /** Inner padding in px. */
  padding?: number;
  /** Makes the whole card a button with press feedback. */
  onPress?: PressableScaleProps['onPress'];
  haptic?: PressableScaleProps['haptic'];
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Surface container. `default` is a raised white/dark surface, `tinted` a soft accent wash and
 * `gradient` the brand hero (children should use colors.onHero / onHeroMuted on it).
 */
export function Card({
  variant = 'default',
  padding = 20,
  onPress,
  haptic,
  children,
  style,
  ...viewProps
}: CardProps) {
  const { theme } = useTheme();
  const isGradient = variant === 'gradient';

  const containerStyle: StyleProp<ViewStyle> = [
    {
      borderRadius: theme.radius.xl,
      padding,
      backgroundColor:
        variant === 'tinted'
          ? theme.colors.accentTint
          : isGradient
            ? theme.gradients.hero[1]
            : theme.colors.surface,
      borderWidth: isGradient ? 0 : StyleSheet.hairlineWidth,
      borderColor: variant === 'tinted' ? 'transparent' : theme.colors.border,
    },
    isGradient ? theme.shadows.md : theme.shadows.sm,
    style,
  ];

  const inner = (
    <>
      {isGradient ? (
        // Clipped separately so the card's own shadow is not cut off by overflow: hidden.
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.xl, overflow: 'hidden' }]}
        >
          <LinearGradient
            colors={theme.gradients.hero}
            start={gradientDirection.diagonal.start}
            end={gradientDirection.diagonal.end}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.orb, styles.orbLarge, { backgroundColor: theme.colors.onHeroSurface }]} />
          <View style={[styles.orb, styles.orbSmall, { backgroundColor: theme.colors.onHeroSurface }]} />
        </View>
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <PressableScale
        {...(viewProps as object)}
        accessibilityRole="button"
        onPress={onPress}
        haptic={haptic}
        scaleTo={theme.motion.press.scaleCard}
        style={containerStyle}
      >
        {inner}
      </PressableScale>
    );
  }

  return (
    <View {...viewProps} style={containerStyle}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  orbLarge: {
    width: 180,
    height: 180,
    top: -70,
    end: -50,
  },
  orbSmall: {
    width: 90,
    height: 90,
    bottom: -30,
    start: 24,
  },
});
