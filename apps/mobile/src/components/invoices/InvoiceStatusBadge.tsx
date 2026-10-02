import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { InvoiceStatus } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
  testID?: string;
}

export function InvoiceStatusBadge({
  status,
  size = 'md',
  testID = 'invoice-status-badge',
}: InvoiceStatusBadgeProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const config = {
    DRAFT: {
      bg: theme.colors.surfaceHover,
      text: theme.colors.textSecondary,
      label: t('invoices.status.draft'),
    },
    SENT: {
      bg: theme.colors.infoTint,
      text: theme.colors.infoText,
      label: t('invoices.status.sent'),
    },
    PAID: {
      bg: theme.colors.positiveTint,
      text: theme.colors.positiveText,
      label: t('invoices.status.paid'),
    },
    OVERDUE: {
      bg: theme.colors.negativeTint,
      text: theme.colors.negativeText,
      label: t('invoices.status.overdue'),
    },
  }[status] || {
    bg: theme.colors.surfaceHover,
    text: theme.colors.textSecondary,
    label: status,
  };

  const isSmall = size === 'sm';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={config.label}
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
          borderRadius: theme.radius.sm,
        },
      ]}
    >
      <Text
        style={[
          isSmall ? theme.typography.caption : theme.typography.small,
          styles.text,
          { color: config.text },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
