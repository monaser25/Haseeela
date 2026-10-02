import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { FadeInView } from '../motion';

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
    <FadeInView
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          // 8-digit hex: the tone colour at ~28% so the edge reads as a soft tint, not a hard rule.
          borderColor: `${config.border}47`,
          borderRadius: theme.radius.lg,
        },
        style,
      ]}
    >
      <View style={[styles.iconWrapper, { backgroundColor: `${config.border}26` }]}>
        <Icon size={18} color={config.text} />
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
    </FadeInView>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    flex: 1,
    paddingTop: 4,
  },
  title: {
    marginBottom: 2,
  },
  message: {
    lineHeight: 20,
  },
  actionWrapper: {
    marginTop: 10,
    width: '100%',
  },
});
