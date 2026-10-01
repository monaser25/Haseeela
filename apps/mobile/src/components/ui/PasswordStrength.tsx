import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export function calculatePasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0..4
}

export interface PasswordStrengthProps {
  password: string;
  testID?: string;
}

export function PasswordStrength({ password, testID }: PasswordStrengthProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  if (!password) {
    return null;
  }

  const score = calculatePasswordStrength(password);

  const labels = [
    t('auth.strength.too_short'),
    t('auth.strength.weak'),
    t('auth.strength.fair'),
    t('auth.strength.good'),
    t('auth.strength.strong'),
  ];

  const colors = [
    theme.colors.negative, // 0
    theme.colors.negative, // 1
    theme.colors.warning,  // 2
    theme.colors.info,     // 3
    theme.colors.positive, // 4
  ];

  const textColors = [
    theme.colors.negativeText,
    theme.colors.negativeText,
    theme.colors.warningText,
    theme.colors.infoText,
    theme.colors.positiveText,
  ];

  const activeColor = colors[score];
  const activeTextColor = textColors[score];
  const activeLabel = labels[score];

  return (
    <View
      style={styles.container}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={activeLabel}
    >
      <View style={styles.barsRow}>
        {[0, 1, 2, 3].map((index) => {
          const isFilled = index < score;
          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: isFilled ? activeColor : theme.colors.border,
                  borderRadius: theme.radius.full,
                },
              ]}
              testID={testID ? `${testID}-segment-${index}` : `password-strength-segment-${index}`}
            />
          );
        })}
      </View>

      <Text
        style={[
          theme.typography.smallMedium,
          styles.label,
          {
            color: activeTextColor,
          },
        ]}
        testID={testID ? `${testID}-label` : 'password-strength-label'}
      >
        {activeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -8,
    marginBottom: 16,
    gap: 6,
  },
  barsRow: {
    flexDirection: 'row',
    gap: 4,
    height: 4,
    width: '100%',
  },
  segment: {
    flex: 1,
    height: 4,
  },
  label: {
    marginTop: 2,
  },
});
