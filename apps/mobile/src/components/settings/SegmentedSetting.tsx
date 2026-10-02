import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { IconTile, IconTileProps } from '../ui/IconTile';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  testID: string;
}

export interface SegmentedSettingProps<T extends string> {
  icon: IconTileProps['icon'];
  iconTone?: IconTileProps['tone'];
  title: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** Settings row with a title and a segmented control underneath (theme, language). */
export function SegmentedSetting<T extends string>({
  icon,
  iconTone = 'accent',
  title,
  value,
  options,
  onChange,
}: SegmentedSettingProps<T>) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <IconTile icon={icon} tone={iconTone} />
        <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>{title}</Text>
      </View>

      <View
        style={[
          styles.track,
          { backgroundColor: theme.colors.surfaceHover, borderRadius: theme.radius.md },
        ]}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              testID={option.testID}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.item,
                { borderRadius: theme.radius.sm },
                isSelected && [{ backgroundColor: theme.colors.surface }, theme.shadows.sm],
              ]}
            >
              <Text
                style={[
                  theme.typography.smallMedium,
                  { color: isSelected ? theme.colors.text : theme.colors.textSecondary },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  track: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
