import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { categoryLabel } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export const CATEGORIES = [
  'CLIENT',
  'PROJECT',
  'TOOLS',
  'OPERATIONS',
  'TAXES',
  'OTHER',
] as const;

export interface CategorySelectorProps {
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function CategorySelector({
  value,
  onChange,
  disabled = false,
  testID = 'category-selector',
}: CategorySelectorProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.container} testID={testID}>
      <Text style={[theme.typography.captionUpper, styles.label, { color: theme.colors.textMuted }]}>
        {t('transactions.form.catLabel')}
      </Text>
      <View style={styles.chipsWrap}>
        {CATEGORIES.map((cat) => {
          const isSelected = value === cat;
          const label = categoryLabel(cat, (k) => t(k));

          return (
            <Pressable
              key={cat}
              testID={`category-chip-${cat.toLowerCase()}`}
              accessibilityRole="button"
              accessibilityLabel={`${t('transactions.form.catLabel')}: ${label}`}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onChange(cat)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.colors.accent : theme.colors.surface,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.smallMedium,
                  {
                    color: isSelected ? theme.colors.accentFg : theme.colors.text,
                  },
                ]}
              >
                {label}
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
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // >= 44pt touch target
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
