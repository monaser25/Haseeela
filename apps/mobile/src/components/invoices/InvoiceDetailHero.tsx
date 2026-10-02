import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Invoice } from '@haseela/shared';
import { effectiveInvoiceStatus } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';

export interface InvoiceDetailHeroProps {
  invoice: Invoice;
  testID?: string;
}

export function InvoiceDetailHero({
  invoice,
  testID = 'invoice-detail-hero',
}: InvoiceDetailHeroProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const status = effectiveInvoiceStatus(invoice.status, invoice.dueDate);
  const formattedAmount = formatCurrency(invoice.total, invoice.currency);

  let dateInfo = '';
  if (status === 'PAID' && invoice.paidAt) {
    try {
      dateInfo = `${t('invoices.detail.paidLabel')}: ${formatDate(new Date(invoice.paidAt), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    } catch {
      dateInfo = '';
    }
  } else if (invoice.dueDate) {
    try {
      const parsedDue = parseCalendarDate(invoice.dueDate);
      dateInfo = `${t('invoices.detail.dueLabel')}: ${formatDate(parsedDue, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    } catch {
      dateInfo = '';
    }
  }

  const clientName = invoice.client?.name || invoice.client?.company;
  const clientEmail = invoice.client?.email;

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.amountCol}>
          <InvoiceStatusBadge status={status} />
          <Text
            style={[theme.typography.h1, styles.amount, { color: theme.colors.text }]}
            testID="invoice-detail-amount"
          >
            {formattedAmount}
          </Text>
          {Boolean(dateInfo) && (
            <Text
              style={[
                theme.typography.caption,
                styles.dateInfo,
                { color: theme.colors.textSecondary },
              ]}
            >
              {dateInfo}
            </Text>
          )}
        </View>

        <View style={styles.clientCol}>
          <Text
            style={[
              theme.typography.captionUpper,
              styles.toLabel,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('invoices.doc.billedTo')}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.clientName,
              { color: theme.colors.text },
            ]}
            numberOfLines={1}
            testID="invoice-detail-client-name"
          >
            {clientName || t('invoices.editor.noClient')}
          </Text>
          {Boolean(clientEmail) && (
            <Text
              style={[
                theme.typography.caption,
                styles.clientEmail,
                { color: theme.colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {clientEmail}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  amountCol: {
    flex: 1,
    gap: 6,
  },
  amount: {
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  dateInfo: {
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  clientCol: {
    alignItems: 'flex-end',
    maxWidth: '45%',
    gap: 2,
  },
  toLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  clientName: {
    textAlign: 'right',
  },
  clientEmail: {
    textAlign: 'right',
  },
});
