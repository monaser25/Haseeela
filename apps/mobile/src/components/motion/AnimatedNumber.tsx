import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextProps } from 'react-native';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { motion } from '../../theme';
import { useReduceMotion } from './useReduceMotion';

/** Discrete frames in a count-up. 24 steps over 0.9s reads as smooth for a money figure. */
export const COUNT_STEPS = 24;

/**
 * Pre-formats every frame of a count-up with the caller's formatter, so currency, locale digits
 * and grouping are exactly what the app renders statically. The first frame is the start value
 * and the last is exactly the target.
 */
export function buildCountFrames(
  from: number,
  to: number,
  format: (value: number) => string,
  steps: number = COUNT_STEPS
): string[] {
  const frames: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / steps;
    const eased = 1 - Math.pow(1 - t, 3);
    frames.push(format(from + (to - from) * eased));
  }
  frames.push(format(to));
  return frames;
}

export interface AnimatedNumberProps extends Omit<TextProps, 'children'> {
  value: number;
  /** Same formatter the static UI uses, e.g. (n) => formatCurrency(n, currency). */
  format: (value: number) => string;
  /** Count up from 0 the first time it appears. Later value changes always animate from the previous value. */
  animateOnMount?: boolean;
  duration?: number;
}

/**
 * Text that counts to `value`. The tween runs on the UI thread; the displayed string only changes
 * at COUNT_STEPS discrete frames (never per frame) and always lands on format(value). With OS
 * reduce-motion on it renders the final value immediately.
 */
export function AnimatedNumber({
  value,
  format,
  animateOnMount = true,
  duration = motion.duration.count,
  accessibilityLabel,
  ...textProps
}: AnimatedNumberProps) {
  const reduceMotion = useReduceMotion();
  const formatRef = useRef(format);
  formatRef.current = format;

  const fromRef = useRef(animateOnMount ? 0 : value);
  const framesRef = useRef<string[]>([]);
  const animatingRef = useRef(false);
  const progress = useSharedValue(0);

  const [text, setText] = useState(() => format(reduceMotion || !animateOnMount ? value : 0));

  const showFrame = useCallback((index: number) => {
    const frame = framesRef.current[index];
    if (frame !== undefined) setText(frame);
  }, []);

  const finish = useCallback(() => {
    animatingRef.current = false;
    framesRef.current = [];
    setText(formatRef.current(value));
  }, [value]);

  useEffect(() => {
    if (reduceMotion || fromRef.current === value) {
      cancelAnimation(progress);
      animatingRef.current = false;
      framesRef.current = [];
      fromRef.current = value;
      setText(formatRef.current(value));
      return;
    }

    framesRef.current = buildCountFrames(fromRef.current, value, formatRef.current);
    animatingRef.current = true;
    fromRef.current = value;
    setText(framesRef.current[0]);
    progress.value = 0;
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [value, reduceMotion, duration, progress, finish]);

  // The formatter changes with locale/currency. If nothing is animating, refresh the static text.
  useEffect(() => {
    if (!animatingRef.current) setText(format(value));
  }, [format, value]);

  useAnimatedReaction(
    () => Math.round(progress.value * COUNT_STEPS),
    (index, previous) => {
      if (index !== previous) runOnJS(showFrame)(index);
    }
  );

  return (
    <Text {...textProps} accessibilityLabel={accessibilityLabel ?? format(value)}>
      {text}
    </Text>
  );
}
