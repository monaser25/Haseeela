import React, { useCallback } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { motion } from '../../theme';
import { useReduceMotion } from './useReduceMotion';
import { HapticKind, triggerHaptic } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Defaults to the button scale; pass motion.press.scaleCard for big cards. */
  scaleTo?: number;
  /** Light haptic on press. Off by default; opt in for primary actions and toggles. */
  haptic?: HapticKind | false;
  /** Resting opacity (e.g. 0.55 for a disabled control). Press dimming multiplies with it. */
  restOpacity?: number;
}

/**
 * Pressable with a spring scale-down on press (UI thread). With OS reduce-motion on it dims
 * instead of scaling. Accessibility props, testID and onPress pass straight through to Pressable.
 */
export function PressableScale({
  children,
  style,
  scaleTo = motion.press.scale,
  haptic = false,
  restOpacity = 1,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: restOpacity * opacity.value,
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (reduceMotion) {
        opacity.value = withTiming(0.7, { duration: 80 });
      } else {
        scale.value = withSpring(scaleTo, motion.spring.press);
      }
      onPressIn?.(event);
    },
    [reduceMotion, scale, opacity, scaleTo, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (reduceMotion) {
        opacity.value = withTiming(1, { duration: motion.duration.fast });
      } else {
        scale.value = withSpring(1, motion.spring.press);
      }
      onPressOut?.(event);
    },
    [reduceMotion, scale, opacity, onPressOut]
  );

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (haptic) triggerHaptic(haptic);
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <AnimatedPressable
      {...rest}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
