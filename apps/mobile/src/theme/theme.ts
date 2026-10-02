import { ColorTokens, lightColors, darkColors } from './colors';
import { spacing, Spacing } from './spacing';
import { radius, Radius } from './radius';
import { typography, Typography } from './typography';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: Spacing;
  radius: Radius;
  typography: Typography;
}

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
};
