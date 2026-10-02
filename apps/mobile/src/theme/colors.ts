export interface ColorTokens {
  accent: string;
  accentHover: string;
  /** Accent for text/icons drawn on bg, surface or accentTint (AA on all of them). */
  accentText: string;
  accentTint: string;
  /** Selected-state fill that must read clearly on surface (tab bar pill). */
  accentTintStrong: string;
  accentFg: string;

  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  positive: string;
  positiveTint: string;
  positiveText: string;

  negative: string;
  negativeTint: string;
  negativeText: string;

  warning: string;
  warningTint: string;
  warningText: string;

  info: string;
  infoTint: string;
  infoText: string;

  /** Text/icons on the hero gradient (AA against every hero stop). */
  onHero: string;
  onHeroMuted: string;
  /** Translucent chip/tile fill used on top of the hero gradient. */
  onHeroSurface: string;
  /** Dimmed backdrop behind sheets and modals. */
  scrim: string;
  /** Base colour for drop shadows. */
  shadow: string;

  deviceBezel: string;
}

/**
 * Light theme: lavender-tinted canvas so white cards float above it.
 * All text tokens achieve WCAG AA contrast (>= 4.5:1) on bg, surface and their own tint.
 */
export const lightColors: ColorTokens = {
  accent: '#6D5EFC',
  accentHover: '#5B4FE0',
  accentText: '#5748E8', // 6.0:1 on #FFFFFF, 5.5:1 on bg, 5.2:1 on accentTint
  accentTint: '#EEEDFE',
  accentTintStrong: '#E1DCFF', // accentText 4.6:1 on it
  accentFg: '#FFFFFF', // 4.5:1 on accent

  bg: '#F6F5FC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHover: '#EDECF7',
  border: '#E8E6F3',
  borderStrong: '#D3D0E4',

  text: '#14121F', // 16.9:1 on bg
  textSecondary: '#4F4B63', // 8.3:1 on surface, 7.6:1 on bg
  textMuted: '#6B6880', // 5.4:1 on surface, 4.9:1 on bg, 4.6:1 on surfaceHover

  positive: '#10B981',
  positiveTint: '#ECFDF5',
  positiveText: '#047857', // 5.2:1 on positiveTint
  negative: '#EF4444',
  negativeTint: '#FEF2F2',
  negativeText: '#C62828', // 5.1:1 on negativeTint (was 4.4:1)
  warning: '#F59E0B',
  warningTint: '#FEF3C7',
  warningText: '#B45309', // 4.5:1 on warningTint
  info: '#0EA5E9',
  infoTint: '#E0F2FE',
  infoText: '#0369A1', // 5.2:1 on infoTint

  onHero: '#FFFFFF', // 5.1:1 on the lightest hero stop
  onHeroMuted: '#F3F1FF', // 4.5:1 on the lightest hero stop
  onHeroSurface: 'rgba(255, 255, 255, 0.18)',
  scrim: 'rgba(20, 18, 31, 0.45)',
  shadow: '#2A1F6B',

  deviceBezel: '#1A1A1F',
};

/**
 * Dark theme: deep indigo-black canvas, surfaces separated by lightness steps and hairlines
 * rather than shadows.
 */
export const darkColors: ColorTokens = {
  accent: '#6C5DFA',
  accentHover: '#7D70FF',
  accentText: '#9D94FF', // 7.0:1 on surface, 6.1:1 on accentTint
  accentTint: '#221F3F',
  accentTintStrong: '#2B2752',
  accentFg: '#FFFFFF', // 4.6:1 on accent

  bg: '#0B0A12',
  surface: '#15141F',
  surfaceElevated: '#1D1C2A',
  surfaceHover: '#242233',
  border: '#2A2838',
  borderStrong: '#3C3A4F',

  text: '#F4F3FA', // 17.9:1 on bg
  textSecondary: '#A9A6BD', // 7.7:1 on surface
  textMuted: '#A9A6BD', // 7.1:1 on surfaceElevated, 6.6:1 on surfaceHover

  positive: '#34D399',
  positiveTint: '#0E2A22',
  positiveText: '#34D399',
  negative: '#F87171',
  negativeTint: '#2A1414',
  negativeText: '#F87171',
  warning: '#FBBF24',
  warningTint: '#2A1F0A',
  warningText: '#FBBF24',
  info: '#38BDF8',
  infoTint: '#0A2030',
  infoText: '#38BDF8',

  onHero: '#FFFFFF', // 5.5:1 on the lightest hero stop
  onHeroMuted: '#F3F1FF', // 4.9:1 on the lightest hero stop
  onHeroSurface: 'rgba(255, 255, 255, 0.14)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',

  deviceBezel: '#0A0A0C',
};
