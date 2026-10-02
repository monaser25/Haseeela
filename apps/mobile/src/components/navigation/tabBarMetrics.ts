/** Geometry shared by the floating tab bar and the center FAB so they stay aligned. */
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_FAB_SIZE = 58;
/** How far the FAB rises above the bar's top edge. */
export const TAB_BAR_FAB_RAISE = 20;
export const TAB_BAR_MARGIN_X = 16;

export function tabBarBottomPadding(insetBottom: number): number {
  return Math.max(insetBottom, 10);
}

/** Distance from the screen bottom to the FAB's bottom edge. */
export function tabBarFabBottom(insetBottom: number): number {
  return tabBarBottomPadding(insetBottom) + (TAB_BAR_HEIGHT - TAB_BAR_FAB_SIZE) / 2 + TAB_BAR_FAB_RAISE;
}
