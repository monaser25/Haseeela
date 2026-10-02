import React, { useEffect, useState } from 'react';
import { View, StyleProp, ViewStyle, LayoutChangeEvent, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, gradientDirection } from '../../theme';
import { useI18n } from '../../i18n';
import { useReduceMotion } from './useReduceMotion';

export interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SWEEP_MS = 1300;

/**
 * Loading placeholder with a soft highlight sweeping across (UI thread). The sweep follows the
 * reading direction (reversed in RTL). Static block when OS reduce-motion is on.
 */
export function Skeleton({ width = '100%', height = 16, radius, style, testID }: SkeletonProps) {
  const { theme } = useTheme();
  const { isRTL } = useI18n();
  const reduceMotion = useReduceMotion();
  const [blockWidth, setBlockWidth] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || blockWidth === 0) {
      cancelAnimation(sweep);
      return;
    }
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(sweep);
  }, [reduceMotion, blockWidth, sweep]);

  const direction = isRTL ? -1 : 1;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: direction * (-blockWidth + sweep.value * blockWidth * 2) }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setBlockWidth(Math.round(event.nativeEvent.layout.width));
  };

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleLayout}
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.md,
          backgroundColor: theme.colors.surfaceHover,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {reduceMotion || blockWidth === 0 ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <LinearGradient
            colors={theme.gradients.shimmer}
            start={gradientDirection.horizontal.start}
            end={gradientDirection.horizontal.end}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}
