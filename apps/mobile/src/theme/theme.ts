import { ColorTokens, lightColors, darkColors } from './colors';
import { spacing, Spacing } from './spacing';
import { radius, Radius } from './radius';
import { typography, Typography } from './typography';
import { GradientTokens, lightGradients, darkGradients } from './gradients';
import { ShadowTokens, createShadows } from './shadows';
import { motion, Motion } from './motion';

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: Spacing;
  radius: Radius;
  typography: Typography;
  gradients: GradientTokens;
  shadows: ShadowTokens;
  motion: Motion;
}

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  gradients: lightGradients,
  shadows: createShadows(lightColors.shadow, false),
  motion,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
  gradients: darkGradients,
  shadows: createShadows(darkColors.shadow, true),
  motion,
};
