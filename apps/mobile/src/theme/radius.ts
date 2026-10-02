export const radius = {
  none: 0,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export type Radius = typeof radius;
export type RadiusKey = keyof typeof radius;
