import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export type IconTileTone = 'accent' | 'info' | 'positive' | 'negative' | 'warning' | 'neutral';

export interface IconTileIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export interface IconTileProps {
  icon: React.ComponentType<IconTileIconProps>;
  tone?: IconTileTone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Rounded-square tile with a tinted background and a matching glyph (settings rows, list rows). */
export function IconTile({ icon: Icon, tone = 'accent', size = 40, style }: IconTileProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const palette = {
    accent: { bg: colors.accentTint, fg: colors.accentText },
    info: { bg: colors.infoTint, fg: colors.infoText },
    positive: { bg: colors.positiveTint, fg: colors.positiveText },
    negative: { bg: colors.negativeTint, fg: colors.negativeText },
    warning: { bg: colors.warningTint, fg: colors.warningText },
    neutral: { bg: colors.surfaceHover, fg: colors.textSecondary },
  }[tone];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.5)} color={palette.fg} strokeWidth={2} />
    </View>
  );
}
