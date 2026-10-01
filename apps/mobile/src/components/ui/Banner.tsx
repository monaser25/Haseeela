import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../theme';

export type BannerTone = 'error' | 'warning' | 'notice' | 'success';

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Banner({
  tone = 'error',
  title,
  message,
  children,
  style,
  testID,
}: BannerProps) {
  const { theme } = useTheme();

  const getToneConfig = () => {
    switch (tone) {
      case 'error':
        return {
          bg: theme.colors.negativeTint,
          border: theme.colors.negative,
          text: theme.colors.negativeText,
          IconComponent: AlertCircle,
        };
      case 'warning':
        return {
          bg: theme.colors.warningTint,
          border: theme.colors.warning,
          text: theme.colors.warningText,
          IconComponent: AlertTriangle,
        };
      case 'notice':
        return {
          bg: theme.colors.infoTint,
          border: theme.colors.info,
          text: theme.colors.infoText,
          IconComponent: Info,
        };
      case 'success':
        return {
          bg: theme.colors.positiveTint,
          border: theme.colors.positive,
          text: theme.colors.positiveText,
          IconComponent: CheckCircle2,
        };
    }
  };

  const config = getToneConfig();
  const Icon = config.IconComponent;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          borderRadius: theme.radius.md,
        },
        style,
      ]}
    >
      <View style={styles.iconWrapper}>
        <Icon size={20} color={config.text} />
      </View>

      <View style={styles.contentWrapper}>
        {title ? (
          <Text
            style={[
              theme.typography.h3,
              styles.title,
              {
                color: config.text,
              },
            ]}
          >
            {title}
          </Text>
        ) : null}

        {message ? (
          <Text
            style={[
              theme.typography.smallMedium,
              styles.message,
              {
                color: config.text,
              },
            ]}
          >
            {message}
          </Text>
        ) : null}

        {children ? <View style={styles.actionWrapper}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrapper: {
    marginTop: 2,
  },
  contentWrapper: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  message: {
    lineHeight: 20,
  },
  actionWrapper: {
    marginTop: 8,
    width: '100%',
  },
});
