/**
 * Motion tokens. Plain data only (no Reanimated import) so the theme stays free of native deps;
 * the motion primitives in components/motion turn these into Reanimated configs.
 */
export const motion = {
  duration: {
    /** Press release, toggles. */
    fast: 140,
    /** Fades, colour changes. */
    base: 240,
    /** Entrances. */
    slow: 420,
    /** Count-up of hero numbers. */
    count: 900,
  },
  /** Cubic-bezier control points: quick start, long soft landing. */
  easing: {
    out: [0.22, 1, 0.36, 1],
    inOut: [0.65, 0, 0.35, 1],
  },
  spring: {
    /** Press feedback: fast, no overshoot. */
    press: { damping: 22, stiffness: 420, mass: 0.7 },
    /** Indicators and the tab pill: slight settle. */
    snappy: { damping: 18, stiffness: 260, mass: 0.8 },
    /** Entrances. */
    gentle: { damping: 20, stiffness: 150, mass: 1 },
  },
  press: {
    /** Scale for buttons and small controls. */
    scale: 0.97,
    /** Scale for large cards and rows. */
    scaleCard: 0.985,
  },
  stagger: {
    /** Delay between consecutive items. */
    step: 60,
    /** Items past this index enter together so long lists never wait. */
    maxItems: 8,
  },
} as const;

export type Motion = typeof motion;
