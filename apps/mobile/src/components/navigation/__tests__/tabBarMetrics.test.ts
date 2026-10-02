import {
  slotFor,
  calculateSlotLayout,
  CENTER_SLOT,
  TAB_BAR_HEIGHT,
  TAB_BAR_FAB_SIZE,
  TAB_BAR_FAB_RAISE,
  tabBarBottomPadding,
  tabBarFabBottom,
} from '../tabBarMetrics';

describe('tabBarMetrics', () => {
  describe('slotFor', () => {
    it('leaves slot 2 open for the center FAB in a 5-slot bar', () => {
      expect(CENTER_SLOT).toBe(2);
      expect(slotFor(0)).toBe(0); // Home
      expect(slotFor(1)).toBe(1); // Transactions
      expect(slotFor(2)).toBe(3); // Clients (skips slot 2)
      expect(slotFor(3)).toBe(4); // More
    });
  });

  describe('tabBarBottomPadding and tabBarFabBottom', () => {
    it('computes safe bottom insets and fab position', () => {
      expect(tabBarBottomPadding(0)).toBe(10);
      expect(tabBarBottomPadding(34)).toBe(34);

      const fabBottom = tabBarFabBottom(34);
      expect(fabBottom).toBe(
        34 + (TAB_BAR_HEIGHT - TAB_BAR_FAB_SIZE) / 2 + TAB_BAR_FAB_RAISE
      );
    });
  });

  describe('calculateSlotLayout (LTR & RTL geometry)', () => {
    const screenWidths = [360, 390, 412, 768];

    it('returns zero dimensions for non-positive barWidth or slotCount', () => {
      expect(calculateSlotLayout(0, 0, 5, false)).toEqual({ x: 0, width: 0 });
      expect(calculateSlotLayout(0, -100, 5, false)).toEqual({ x: 0, width: 0 });
      expect(calculateSlotLayout(0, 390, 0, false)).toEqual({ x: 0, width: 0 });
    });

    screenWidths.forEach((barWidth) => {
      const slotWidth = barWidth / 5;

      describe(`at width ${barWidth}px`, () => {
        it('calculates strictly left-to-right positions in LTR', () => {
          // LTR: slot 0 (leftmost) -> slot 4 (rightmost)
          for (let slot = 0; slot < 5; slot++) {
            const layout = calculateSlotLayout(slot, barWidth, 5, false);
            expect(layout.width).toBeCloseTo(slotWidth);
            expect(layout.x).toBeCloseTo(slot * slotWidth);
          }
        });

        it('mirrors positions accurately in RTL (Arabic)', () => {
          // RTL: slot 0 (Home) is placed at visual index 4 (far right)
          // slot 4 (More) is placed at visual index 0 (far left)
          // slot 2 (FAB) remains exactly centered at visual index 2
          const homeLayout = calculateSlotLayout(0, barWidth, 5, true);
          expect(homeLayout.x).toBeCloseTo(4 * slotWidth);
          expect(homeLayout.width).toBeCloseTo(slotWidth);

          const txLayout = calculateSlotLayout(1, barWidth, 5, true);
          expect(txLayout.x).toBeCloseTo(3 * slotWidth);

          const fabLayout = calculateSlotLayout(2, barWidth, 5, true);
          expect(fabLayout.x).toBeCloseTo(2 * slotWidth);

          const clientsLayout = calculateSlotLayout(3, barWidth, 5, true);
          expect(clientsLayout.x).toBeCloseTo(1 * slotWidth);

          const moreLayout = calculateSlotLayout(4, barWidth, 5, true);
          expect(moreLayout.x).toBeCloseTo(0 * slotWidth);
        });

        it('guarantees center FAB slot is in the exact same middle position in both LTR and RTL', () => {
          const ltrFab = calculateSlotLayout(CENTER_SLOT, barWidth, 5, false);
          const rtlFab = calculateSlotLayout(CENTER_SLOT, barWidth, 5, true);

          expect(ltrFab.x).toBeCloseTo(rtlFab.x);
          expect(ltrFab.width).toBeCloseTo(rtlFab.width);
        });
      });
    });
  });
});
