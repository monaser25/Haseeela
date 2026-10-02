import { ViewStyle } from 'react-native';

export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export interface ShadowTokens {
  none: ShadowStyle;
  /** Resting cards and list groups. */
  sm: ShadowStyle;
  /** Hero cards, floating tab bar. */
  md: ShadowStyle;
  /** Sheets, FAB. */
  lg: ShadowStyle;
}

const NONE: ShadowStyle = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

/**
 * Tinted (not grey) shadows in light mode. In dark mode small shadows are invisible against the
 * canvas, so depth comes from surface lightness and hairline borders; only md/lg keep a shadow.
 */
export function createShadows(shadowColor: string, dark: boolean): ShadowTokens {
  if (dark) {
    return {
      none: NONE,
      sm: NONE,
      md: { shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 4 },
      lg: { shadowColor, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 8 },
    };
  }
  return {
    none: NONE,
    sm: { shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 },
    md: { shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 4 },
    lg: { shadowColor, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 28, elevation: 8 },
  };
}
