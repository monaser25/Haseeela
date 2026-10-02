export type GradientStops = readonly [string, string, ...string[]];

export interface GradientTokens {
  /** Hero balance card. */
  hero: GradientStops;
  /** Primary call-to-action fills. */
  accent: GradientStops;
  /** Highlight sweep used by skeleton shimmer (transparent, tint, transparent). */
  shimmer: GradientStops;
}

export const gradientDirection = {
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  horizontal: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
} as const;

export const lightGradients: GradientTokens = {
  hero: ['#6455F4', '#5242E6', '#3F31C4'],
  accent: ['#7466FF', '#5B4FE0'],
  shimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'],
};

export const darkGradients: GradientTokens = {
  hero: ['#5F50EC', '#4B3CD9', '#33279F'],
  accent: ['#7D70FF', '#5F50EC'],
  shimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)'],
};
