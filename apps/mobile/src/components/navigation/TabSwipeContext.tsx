import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export interface TabSwipeContextValue {
  /** Continuous drag progress between current tab and adjacent tab (-1 to 1) */
  swipeProgress: SharedValue<number>;
  /** Whether a tab swipe gesture is actively occurring */
  isSwiping: SharedValue<boolean>;
  /** Target slot index being dragged toward (or -1 if none) */
  targetSlot: SharedValue<number>;
  /** Currently active tab index (0..3) */
  activeIndex: number;
}

export const TabSwipeContext = createContext<TabSwipeContextValue | null>(null);

export function useTabSwipe(): TabSwipeContextValue | null {
  return useContext(TabSwipeContext);
}
