import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

/**
 * App-wide "dip" transition for changes that restyle or re-lay-out the whole tree at once
 * (theme, language/direction). A full-screen cover fades in over the current content, the change
 * is committed while the content is hidden, then the cover fades out to reveal the new state.
 * This avoids the jarring one-frame flip and needs no screenshot of the old UI.
 */
export type RunCoverTransition = (commit: () => void, coverColor?: string) => void;

/** Fade-in of the cover over the old state. */
export const COVER_IN_MS = 90;
/** Fade-out of the cover, revealing the new state. */
export const COVER_OUT_MS = 170;
/** Frames given to React + the native mount to apply the committed change before revealing it. */
const SETTLE_FRAMES = 2;

const instant: RunCoverTransition = (commit) => commit();

const CoverTransitionContext = createContext<RunCoverTransition>(instant);

/**
 * Returns a runner that commits a change under the cover. Without a provider (tests, isolated
 * trees) or with OS reduce-motion on, the change is committed immediately with no motion.
 */
export function useCoverTransition(): RunCoverTransition {
  return useContext(CoverTransitionContext);
}

interface ActiveCover {
  color: string;
}

export function CoverTransitionProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0);
  const [cover, setCover] = useState<ActiveCover | null>(null);
  const busyRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const run = useCallback<RunCoverTransition>(
    (commit, coverColor = '#000000') => {
      // A second change while a transition runs is committed straight away (the commit callbacks
      // read the latest requested value, so the end state is always the newest request).
      if (reduceMotion || busyRef.current) {
        commit();
        return;
      }
      busyRef.current = true;
      opacity.set(0);
      setCover({ color: coverColor });
      opacity.set(withTiming(1, { duration: COVER_IN_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) }));

      const finish = () => {
        busyRef.current = false;
        if (isMountedRef.current) setCover(null);
      };

      const reveal = () => {
        if (!isMountedRef.current) return;
        let frames = SETTLE_FRAMES;
        const step = () => {
          frames -= 1;
          if (frames > 0) {
            frameRef.current = requestAnimationFrame(step);
            return;
          }
          frameRef.current = null;
          opacity.set(withTiming(0, { duration: COVER_OUT_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
          timersRef.current.push(setTimeout(finish, COVER_OUT_MS + 30));
        };
        frameRef.current = requestAnimationFrame(step);
      };

      // JS timers (not animation callbacks) sequence the phases, so an interrupted animation can
      // never leave the cover stuck on screen blocking touches.
      timersRef.current.push(
        setTimeout(() => {
          try {
            commit();
          } finally {
            reveal();
          }
        }, COVER_IN_MS)
      );
    },
    [opacity, reduceMotion]
  );

  const coverStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const value = useMemo(() => run, [run]);

  return (
    <CoverTransitionContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {cover ? (
          <Animated.View
            testID="transition-cover"
            // Swallows touches for the ~300ms the swap takes so nothing is pressed mid-change.
            pointerEvents="auto"
            style={[styles.cover, { backgroundColor: cover.color }, coverStyle]}
          />
        ) : null}
      </View>
    </CoverTransitionContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
});
