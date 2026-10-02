import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

export interface AuthHeaderProps {
  title: string;
  sub?: string;
  brandName?: string;
}

export function AuthHeader({ title, sub, brandName }: AuthHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {brandName ? (
        <Text
          style={[
            theme.typography.captionUpper,
            styles.brand,
            {
              color: theme.colors.accent,
            },
          ]}
          testID="auth-brand-name"
        >
          {brandName}
        </Text>
      ) : null}

      <Text
        accessibilityRole="header"
        style={[
          theme.typography.title,
          styles.title,
          {
            color: theme.colors.text,
          },
        ]}
      >
        {title}
      </Text>

      {sub ? (
        <Text
          style={[
            theme.typography.body,
            styles.subtitle,
            {
              color: theme.colors.textSecondary,
            },
          ]}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  brand: {
    marginBottom: 6,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 22,
  },
});
