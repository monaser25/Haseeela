import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface SectionHeaderProps {
  title: string;
  /** `title` is a screen-section heading; `label` the small caption above a grouped list. */
  variant?: 'title' | 'label';
  /** Overrides the text colour (e.g. the danger-zone label). */
  color?: string;
  /** Optional trailing element, e.g. a small icon or a link. */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Title row for a block of content. */
export function SectionHeader({
  title,
  variant = 'title',
  color,
  trailing,
  style,
  testID,
}: SectionHeaderProps) {
  const { theme } = useTheme();
  const isLabel = variant === 'label';

  return (
    <View style={[styles.row, isLabel && styles.labelRow, style]} testID={testID}>
      <Text
        accessibilityRole="header"
        style={[
          isLabel ? theme.typography.smallMedium : theme.typography.h2,
          styles.title,
          { color: color ?? (isLabel ? theme.colors.textSecondary : theme.colors.text) },
        ]}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelRow: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    flexShrink: 1,
  },
});
