import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Invoice } from '@haseela/shared';
import { effectiveInvoiceStatus } from '@haseela/shared';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

export interface InvoiceRowProps {
  invoice: Invoice;
  onPress: (item: Invoice) => void;
  testID?: string;
}

function InvoiceRowBase({
  invoice,
  onPress,
  testID,
}: InvoiceRowProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const status = effectiveInvoiceStatus(invoice.status, invoice.dueDate);
  const clientName = invoice.client?.name || invoice.client?.company;
  const primaryTitle = clientName
    ? `#${invoice.number} · ${clientName}`
    : `#${invoice.number}`;

  const formattedAmount = formatCurrency(invoice.total, invoice.currency);

  let dateSub = '';
  if (status === 'PAID' && invoice.paidAt) {
    try {
      dateSub = formatDate(new Date(invoice.paidAt), {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      dateSub = '';
    }
  } else if (invoice.dueDate) {
    try {
      const parsedDue = parseCalendarDate(invoice.dueDate);
      dateSub = `${t('invoices.table.due')} ${formatDate(parsedDue, {
        month: 'short',
        day: 'numeric',
      })}`;
    } catch {
      dateSub = '';
    }
  }

  const accessibilityLabel = `${primaryTitle}, ${formattedAmount}, ${status}${dateSub ? `, ${dateSub}` : ''}`;

  return (
    <Pressable
      testID={testID ?? `invoice-row-${invoice.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(invoice)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[theme.typography.bodySemiBold, styles.primaryText, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {primaryTitle}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.amount,
              { color: theme.colors.text },
            ]}
          >
            {formattedAmount}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <InvoiceStatusBadge status={status} size="sm" />
          {Boolean(dateSub) && (
            <Text
              style={[
                theme.typography.caption,
                styles.subText,
                { color: theme.colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {dateSub}
            </Text>
          )}
        </View>
      </View>

      <ChevronRight size={18} color={theme.colors.textMuted} style={styles.chevron} />
    </Pressable>
  );
}

export const InvoiceRow = React.memo(InvoiceRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    minHeight: 64,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryText: {
    flex: 1,
    marginEnd: 12,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subText: {
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    marginStart: 8,
  },
});
