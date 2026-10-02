import { TextStyle } from 'react-native';

export type TypographyStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
>;

export const typography = {
  /** Big balance figure on the hero card. */
  display: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  /** Medium money figure (stat tiles). */
  amount: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodySemiBold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  smallMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  captionUpper: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
} as const satisfies Record<string, TypographyStyle>;

export type Typography = typeof typography;
export type TypographyKey = keyof typeof typography;
