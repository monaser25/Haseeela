import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface SectionHeaderProps {
  title: string;
  /** Optional trailing element, e.g. a small icon or a link. */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Title row for a block of content. */
export function SectionHeader({ title, trailing, style, testID }: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.row, style]} testID={testID}>
      <Text
        accessibilityRole="header"
        style={[theme.typography.h2, styles.title, { color: theme.colors.text }]}
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
  title: {
    flexShrink: 1,
  },
});
