import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export function getNameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface AvatarProps {
  name: string;
  size?: number;
  /** Fixed palette slot; by default one is picked from the name so each person keeps their colour. */
  tone?: 'accent' | 'info' | 'positive' | 'warning';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TONES = ['accent', 'info', 'positive', 'warning'] as const;

/** Initials in a soft tinted circle. */
export function Avatar({ name, size = 44, tone, style, testID }: AvatarProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const resolved = tone ?? TONES[hashName(name) % TONES.length];
  const palette = {
    accent: { bg: colors.accentTint, fg: colors.accentText },
    info: { bg: colors.infoTint, fg: colors.infoText },
    positive: { bg: colors.positiveTint, fg: colors.positiveText },
    warning: { bg: colors.warningTint, fg: colors.warningText },
  }[resolved];

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: palette.fg,
          fontSize: Math.round(size * 0.36),
          fontWeight: '700',
        }}
      >
        {getNameInitials(name)}
      </Text>
    </View>
  );
}
