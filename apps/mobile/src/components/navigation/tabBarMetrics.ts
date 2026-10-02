/** Geometry shared by the floating tab bar and the center FAB so they stay aligned. */
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_FAB_SIZE = 58;
/** How far the FAB rises above the bar's top edge. */
export const TAB_BAR_FAB_RAISE = 20;
export const TAB_BAR_MARGIN_X = 16;

/** The center slot is reserved for the floating action button. */
export const CENTER_SLOT = 2;

export function tabBarBottomPadding(insetBottom: number): number {
  return Math.max(insetBottom, 10);
}

/** Distance from the screen bottom to the FAB's bottom edge. */
export function tabBarFabBottom(insetBottom: number): number {
  return tabBarBottomPadding(insetBottom) + (TAB_BAR_HEIGHT - TAB_BAR_FAB_SIZE) / 2 + TAB_BAR_FAB_RAISE;
}

/**
 * Slot index of a route once the center FAB slot is accounted for.
 * Routes: 0 (index), 1 (transactions), 2 (clients), 3 (more)
 * Slots:  0 (index), 1 (transactions), 2 (FAB), 3 (clients), 4 (more)
 */
export function slotFor(routeIndex: number): number {
  'worklet';
  return routeIndex >= CENTER_SLOT ? routeIndex + 1 : routeIndex;
}

/**
 * Computes exact X position and width for a slot in the tab bar.
 * In LTR: slots 0..4 go from left to right (visualIndex = slot).
 * In RTL: slots 0..4 go from right to left (visualIndex = slotCount - 1 - slot).
 *
 * All coordinates returned are relative to the bar container's left edge (left: 0).
 */
export function calculateSlotLayout(
  slot: number,
  barWidth: number,
  slotCount = 5,
  isRTL = false
): { x: number; width: number } {
  'worklet';
  if (barWidth <= 0 || slotCount <= 0) {
    return { x: 0, width: 0 };
  }
  const slotWidth = barWidth / slotCount;
  const visualIndex = isRTL ? slotCount - 1 - slot : slot;
  return {
    x: visualIndex * slotWidth,
    width: slotWidth,
  };
}
