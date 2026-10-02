export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export type Radius = typeof radius;
export type RadiusKey = keyof typeof radius;
