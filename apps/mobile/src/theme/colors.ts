export interface ColorTokens {
  accent: string;
  accentHover: string;
  accentTint: string;
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

  deviceBezel: string;
}

/**
 * Light theme color tokens.
 * All text tokens achieve WCAG AA contrast (>= 4.5:1 for body text) on surface & bg.
 */
export const lightColors: ColorTokens = {
  accent: '#6D5EFC',
  accentHover: '#5B4FE0',
  accentTint: '#EEEDFE',
  accentFg: '#FFFFFF',

  bg: '#FBFBFD',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHover: '#F4F4F6',
  border: '#E7E7EC',
  borderStrong: '#D4D4D8',

  // WCAG AAA/AA text contrast:
  text: '#18181B', // > 16:1 against #FFFFFF and #FBFBFD
  textSecondary: '#52525B', // > 7:1 against #FFFFFF
  textMuted: '#71717A', // 4.6:1 against #FFFFFF (WCAG AA compliant)

  positive: '#10B981',
  positiveTint: '#ECFDF5',
  positiveText: '#047857', // 5.48:1 against #FFFFFF

  negative: '#EF4444',
  negativeTint: '#FEF2F2',
  negativeText: '#DC2626', // 4.83:1 against #FFFFFF

  warning: '#F59E0B',
  warningTint: '#FEF3C7',
  warningText: '#B45309', // 5.02:1 against #FFFFFF

  info: '#0EA5E9',
  infoTint: '#E0F2FE',
  infoText: '#0369A1', // 5.2:1 against #FFFFFF

  deviceBezel: '#1A1A1F',
};

/**
 * Dark theme color tokens.
 * High contrast on dark backgrounds (#09090B, #18181B).
 */
export const darkColors: ColorTokens = {
  accent: '#7C6FFF',
  accentHover: '#8B7FFF',
  accentTint: '#1C1A33',
  accentFg: '#FFFFFF',

  bg: '#09090B',
  surface: '#18181B',
  surfaceElevated: '#1F1F23',
  surfaceHover: '#222226',
  border: '#27272A',
  borderStrong: '#3F3F46',

  // WCAG AAA/AA text contrast:
  text: '#FAFAFA', // > 17:1 against #09090B
  textSecondary: '#A1A1AA', // > 6:1 against #18181B
  textMuted: '#A1A1AA', // > 6:1 against #18181B

  positive: '#34D399',
  positiveTint: '#0E2A22',
  positiveText: '#34D399', // > 7:1 against #18181B

  negative: '#F87171',
  negativeTint: '#2A1414',
  negativeText: '#F87171', // > 5:1 against #18181B

  warning: '#FBBF24',
  warningTint: '#2A1F0A',
  warningText: '#FBBF24', // > 9:1 against #18181B

  info: '#38BDF8',
  infoTint: '#0A2030',
  infoText: '#38BDF8', // > 8:1 against #18181B

  deviceBezel: '#0A0A0C',
};
