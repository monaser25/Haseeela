import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Invoice } from '@haseela/shared';
import { Check, Send, Clock } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface InvoiceDetailTimelineProps {
  invoice: Invoice;
  testID?: string;
}

export function InvoiceDetailTimeline({
  invoice,
  testID = 'invoice-detail-timeline',
}: InvoiceDetailTimelineProps) {
  const { theme } = useTheme();
  const { t, formatDate } = useI18n();

  const events: Array<{
    id: string;
    icon: any;
    color: string;
    bgColor: string;
    title: string;
    date: string;
  }> = [];

  // 1. Created (always present)
  let createdDateStr = '';
  if (invoice.createdAt) {
    try {
      createdDateStr = formatDate(new Date(invoice.createdAt), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      createdDateStr = invoice.createdAt;
    }
  }

  events.push({
    id: 'created',
    icon: Check,
    color: theme.colors.positiveText,
    bgColor: theme.colors.positiveTint,
    title: t('invoices.timeline.created'),
    date: createdDateStr,
  });

  // 2. Sent to client (only if real sentAt exists)
  if (invoice.sentAt) {
    let sentDateStr = '';
    try {
      sentDateStr = formatDate(new Date(invoice.sentAt), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      sentDateStr = invoice.sentAt;
    }
    events.push({
      id: 'sent',
      icon: Send,
      color: theme.colors.infoText,
      bgColor: theme.colors.infoTint,
      title: t('invoices.timeline.sent'),
      date: sentDateStr,
    });
  }

  // 3. Paid or Awaiting payment
  if (invoice.paidAt) {
    let paidDateStr = '';
    try {
      paidDateStr = formatDate(new Date(invoice.paidAt), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      paidDateStr = invoice.paidAt;
    }
    events.push({
      id: 'paid',
      icon: Check,
      color: theme.colors.positiveText,
      bgColor: theme.colors.positiveTint,
      title: t('invoices.timeline.paid'),
      date: paidDateStr,
    });
  } else if (invoice.status === 'SENT' || invoice.status === 'OVERDUE') {
    events.push({
      id: 'awaiting',
      icon: Clock,
      color: theme.colors.warningText,
      bgColor: theme.colors.warningTint,
      title: t('invoices.timeline.awaiting'),
      date: invoice.dueDate
        ? `${t('invoices.table.due')} ${formatDate(new Date(invoice.dueDate), {
            month: 'short',
            day: 'numeric',
          })}`
        : '',
    });
  }

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
      <Text
        style={[
          theme.typography.captionUpper,
          styles.headerTitle,
          { color: theme.colors.textMuted },
        ]}
      >
        {t('invoices.timeline.title')}
      </Text>

      <View style={styles.eventsList}>
        {events.map((e, idx) => {
          const IconComponent = e.icon;
          return (
            <View key={e.id} style={styles.eventRow} testID={`timeline-event-${e.id}`}>
              <View style={[styles.iconCircle, { backgroundColor: e.bgColor }]}>
                <IconComponent size={14} color={e.color} />
              </View>
              <View style={styles.textCol}>
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    styles.eventTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  {e.title}
                </Text>
                {Boolean(e.date) && (
                  <Text
                    style={[
                      theme.typography.caption,
                      styles.eventDate,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {e.date}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    width: '100%',
    gap: 12,
  },
  headerTitle: {
    marginBottom: 4,
  },
  eventsList: {
    gap: 14,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
  },
  eventDate: {
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
