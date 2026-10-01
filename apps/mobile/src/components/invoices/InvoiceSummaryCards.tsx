import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CurrencyCode, Invoice } from '@haseela/shared';
import { computeInvoiceSummariesByCurrency } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface InvoiceSummaryCardsProps {
  invoices: Invoice[];
  defaultCurrency?: CurrencyCode;
  testID?: string;
}

export function InvoiceSummaryCards({
  invoices,
  defaultCurrency = 'USD',
  testID = 'invoice-summary-cards',
}: InvoiceSummaryCardsProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  const summariesByCurrency = computeInvoiceSummariesByCurrency(invoices);
  const currencies = Object.keys(summariesByCurrency) as CurrencyCode[];

  // Fallback to defaultCurrency if no invoices exist yet
  const displayCurrencies =
    currencies.length > 0 ? currencies : ([defaultCurrency] as CurrencyCode[]);

  return (
    <View testID={testID} style={styles.container}>
      {displayCurrencies.map((ccy) => {
        const summary = summariesByCurrency[ccy] ?? {
          outstanding: 0,
          overdue: 0,
          paid30d: 0,
          count: 0,
        };

        const isMulti = displayCurrencies.length > 1;

        return (
          <View key={ccy} style={styles.currencyBlock} testID={`invoice-summary-group-${ccy}`}>
            {isMulti && (
              <View style={styles.currencyHeader}>
                <Text
                  style={[
                    theme.typography.captionUpper,
                    styles.currencyLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {ccy}
                </Text>
              </View>
            )}

            <View style={styles.grid}>
              {/* Outstanding */}
              <View
                testID={`invoice-summary-outstanding-${ccy}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.captionUpper,
                    styles.tileLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {t('invoices.summary.outstanding')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.bodySemiBold,
                    styles.tileValue,
                    { color: theme.colors.text },
                  ]}
                >
                  {formatCurrency(summary.outstanding, ccy, { maximumFractionDigits: 0 })}
                </Text>
              </View>

              {/* Overdue */}
              <View
                testID={`invoice-summary-overdue-${ccy}`}
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      summary.overdue > 0 ? theme.colors.negativeTint : theme.colors.surface,
                    borderColor: summary.overdue > 0 ? 'transparent' : theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.captionUpper,
                    styles.tileLabel,
                    {
                      color: summary.overdue > 0 ? theme.colors.negative : theme.colors.textMuted,
                    },
                  ]}
                >
                  {t('invoices.summary.overdue')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.bodySemiBold,
                    styles.tileValue,
                    {
                      color: summary.overdue > 0 ? theme.colors.negative : theme.colors.text,
                    },
                  ]}
                >
                  {formatCurrency(summary.overdue, ccy, { maximumFractionDigits: 0 })}
                </Text>
              </View>

              {/* Paid · 30d */}
              <View
                testID={`invoice-summary-paid30d-${ccy}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.captionUpper,
                    styles.tileLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {t('invoices.summary.paid30d')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.bodySemiBold,
                    styles.tileValue,
                    { color: theme.colors.text },
                  ]}
                >
                  {formatCurrency(summary.paid30d, ccy, { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    width: '100%',
  },
  currencyBlock: {
    gap: 4,
  },
  currencyHeader: {
    paddingHorizontal: 2,
  },
  currencyLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  tileValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
});
