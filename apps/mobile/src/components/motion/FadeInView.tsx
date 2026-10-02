import React, { useMemo } from 'react';
import { ViewProps } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { motion } from '../../theme';
import { useReduceMotion } from './useReduceMotion';

/** Entrance delay for the n-th item of a staggered group. Capped so long groups never lag. */
export function staggerDelay(index: number): number {
  const capped = Math.min(Math.max(index, 0), motion.stagger.maxItems);
  return capped * motion.stagger.step;
}

export interface FadeInViewProps extends ViewProps {
  /** Position in a staggered group; later items enter slightly later. */
  index?: number;
  /** Extra delay in ms on top of the stagger. */
  delay?: number;
}

/**
 * Fades and rises into place once when mounted (Reanimated layout animation, UI thread).
 * Renders a plain, instantly visible view when OS reduce-motion is on.
 */
export function FadeInView({ index = 0, delay = 0, children, ...viewProps }: FadeInViewProps) {
  const reduceMotion = useReduceMotion();
  const totalDelay = delay + staggerDelay(index);

  const entering = useMemo(
    () =>
      reduceMotion
        ? undefined
        : FadeInUp.delay(totalDelay)
            .springify()
            .damping(motion.spring.gentle.damping)
            .stiffness(motion.spring.gentle.stiffness)
            .mass(motion.spring.gentle.mass),
    [reduceMotion, totalDelay]
  );

  return (
    <Animated.View entering={entering} {...viewProps}>
      {children}
    </Animated.View>
  );
}
