import { useReducedMotion } from 'react-native-reanimated';

/**
 * True when the OS "reduce motion" accessibility setting is on. Every motion primitive reads this
 * and falls back to a static or opacity-only presentation, so motion is never required to
 * understand the UI.
 */
export function useReduceMotion(): boolean {
  return useReducedMotion();
}
