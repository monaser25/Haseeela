import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Client, CurrencyCode } from '@haseela/shared';
import { supportedCurrencies } from '@haseela/shared';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { TextField, Button } from '../ui';
import { DatePickerField } from '../transactions/DatePickerField';
import { ClientSelector } from '../transactions/ClientSelector';
import type { InvoiceFormData, InvoiceFormErrors } from './invoiceValidation';
import { calculateLiveTotals } from './invoiceValidation';

export interface InvoiceFormFieldsProps {
  data: InvoiceFormData;
  errors: InvoiceFormErrors;
  clients: Client[];
  disabled?: boolean;
  onChange: (updates: Partial<InvoiceFormData>) => void;
  onLineItemChange: (index: number, updates: Partial<InvoiceFormData['lineItems'][0]>) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  testID?: string;
}

export function InvoiceFormFields({
  data,
  errors,
  clients,
  disabled = false,
  onChange,
  onLineItemChange,
  onAddLineItem,
  onRemoveLineItem,
  testID = 'invoice-form-fields',
}: InvoiceFormFieldsProps) {
  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();

  const { subtotal, taxAmount, total } = calculateLiveTotals(
    data.lineItems,
    data.taxRate,
    data.discount
  );

  return (
    <View testID={testID} style={styles.container}>
      {/* General Form Error Banner */}
      {Boolean(errors.general) && (
        <View
          testID="invoice-form-general-error"
          style={[
            styles.errorBanner,
            {
              backgroundColor: theme.colors.negativeTint,
              borderColor: theme.colors.negative,
              borderRadius: theme.radius.sm,
            },
          ]}
        >
          <Text style={[theme.typography.small, { color: theme.colors.negativeText }]}>
            {errors.general}
          </Text>
        </View>
      )}

      {/* Invoice Number (Optional) */}
      <TextField
        label={t('invoices.table.invoice')}
        value={data.number ?? ''}
        onChangeText={(text) => onChange({ number: text })}
        placeholder="INV-0001 (auto)"
        editable={!disabled}
        testID="invoice-number-input"
      />

      {/* Client Selector */}
      <ClientSelector
        clients={clients}
        selectedClientId={data.clientId ?? undefined}
        onChange={(clientId) => onChange({ clientId: clientId ?? null })}
        disabled={disabled}
        testID="invoice-client-selector"
      />

      {/* Currency Selector */}
      <View style={styles.section}>
        <Text
          style={[
            theme.typography.captionUpper,
            styles.label,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('invoices.editor.currencyLabel')}
        </Text>
        <View style={styles.chipRow}>
          {supportedCurrencies.map(({ code }) => {
            const isSelected = data.currency === code;
            return (
              <Pressable
                key={code}
                testID={`currency-chip-${code}`}
                accessibilityRole="button"
                accessibilityLabel={code}
                disabled={disabled}
                onPress={() => onChange({ currency: code as CurrencyCode })}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.accent
                      : theme.colors.surface,
                    borderColor: isSelected
                      ? theme.colors.accent
                      : theme.colors.border,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.captionUpper,
                    {
                      color: isSelected
                        ? theme.colors.surface
                        : theme.colors.text,
                    },
                  ]}
                >
                  {code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Date Pickers (Issue & Due Date) */}
      <View style={styles.datesGrid}>
        <View style={styles.dateCol}>
          <DatePickerField
            label={t('invoices.editor.issueDateLabel')}
            value={data.issueDate}
            onChange={(date) => onChange({ issueDate: date })}
            disabled={disabled}
            testID="invoice-issue-date-picker"
          />
        </View>
        <View style={styles.dateCol}>
          <DatePickerField
            label={t('invoices.editor.dueDateLabel')}
            value={data.dueDate}
            onChange={(date) => onChange({ dueDate: date })}
            disabled={disabled}
            testID="invoice-due-date-picker"
          />
        </View>
      </View>

      {Boolean(errors.dates) && (
        <Text
          testID="invoice-dates-error"
          style={[theme.typography.caption, { color: theme.colors.negative }]}
        >
          {errors.dates}
        </Text>
      )}

      {/* Line Items Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text
            style={[
              theme.typography.captionUpper,
              styles.label,
              { color: theme.colors.textMuted },
            ]}
          >
            {t('invoices.editor.lineItemsLabel')}
          </Text>
        </View>

        {data.lineItems.map((item, index) => {
          const itemErr = errors.lineItems?.[index];
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          const lineTotal = qty * rate;

          return (
            <View
              key={index}
              testID={`line-item-row-${index}`}
              style={[
                styles.lineItemCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <View style={styles.lineItemHeader}>
                <Text
                  style={[
                    theme.typography.captionUpper,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('invoices.doc.description')} #{index + 1}
                </Text>
                {data.lineItems.length > 1 && (
                  <Pressable
                    testID={`remove-line-item-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('invoices.editor.removeLine')}
                    disabled={disabled}
                    onPress={() => onRemoveLineItem(index)}
                    hitSlop={8}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={16} color={theme.colors.negative} />
                  </Pressable>
                )}
              </View>

              <TextField
                label={t('invoices.editor.descriptionPlaceholder')}
                value={item.description}
                onChangeText={(text) => onLineItemChange(index, { description: text })}
                placeholder={t('invoices.doc.itemDescription')}
                error={itemErr?.description}
                editable={!disabled}
                testID={`line-item-desc-${index}`}
              />

              <View style={styles.qtyRateRow}>
                <View style={styles.qtyCol}>
                  <TextField
                    label={t('invoices.editor.qtyPlaceholder')}
                    value={item.quantity}
                    onChangeText={(text) => onLineItemChange(index, { quantity: text })}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    error={itemErr?.quantity}
                    editable={!disabled}
                    testID={`line-item-qty-${index}`}
                  />
                </View>

                <View style={styles.rateCol}>
                  <TextField
                    label={t('invoices.editor.ratePlaceholder')}
                    value={item.rate}
                    onChangeText={(text) => onLineItemChange(index, { rate: text })}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    error={itemErr?.rate}
                    editable={!disabled}
                    testID={`line-item-rate-${index}`}
                  />
                </View>
              </View>

              <View style={styles.lineTotalRow}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('invoices.doc.amount')}:
                </Text>
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    { color: theme.colors.text },
                  ]}
                >
                  {formatCurrency(lineTotal, data.currency)}
                </Text>
              </View>
            </View>
          );
        })}

        <Button
          variant="secondary"
          onPress={onAddLineItem}
          disabled={disabled}
          testID="add-line-item-btn"
        >
          {t('invoices.editor.addLine')}
        </Button>
      </View>

      {/* Adjustments: Discount & Tax */}
      <View style={styles.adjustmentsRow}>
        <View style={styles.adjCol}>
          <TextField
            label={t('invoices.editor.discountLabel')}
            value={data.discount}
            onChangeText={(text) => onChange({ discount: text })}
            keyboardType="decimal-pad"
            placeholder="0"
            error={errors.discount}
            editable={!disabled}
            testID="invoice-discount-input"
          />
        </View>

        <View style={styles.adjCol}>
          <TextField
            label={t('invoices.editor.taxRateLabel')}
            value={data.taxRate}
            onChangeText={(text) => onChange({ taxRate: text })}
            keyboardType="decimal-pad"
            placeholder="0"
            error={errors.taxRate}
            editable={!disabled}
            testID="invoice-tax-rate-input"
          />
        </View>
      </View>

      {/* Live Financial Totals Card */}
      <View
        testID="invoice-live-totals-card"
        style={[
          styles.totalsCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <View style={styles.totalRow}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t('invoices.doc.subtotal')}
          </Text>
          <Text
            style={[
              theme.typography.bodySemiBold,
              styles.tabular,
              { color: theme.colors.text },
            ]}
            testID="live-subtotal-val"
          >
            {formatCurrency(subtotal, data.currency)}
          </Text>
        </View>

        {Number(data.discount) > 0 && (
          <View style={styles.totalRow}>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary },
              ]}
            >
              {t('invoices.doc.discount')}
            </Text>
            <Text
              style={[
                theme.typography.bodySemiBold,
                styles.tabular,
                { color: theme.colors.textSecondary },
              ]}
            >
              -{formatCurrency(Number(data.discount), data.currency)}
            </Text>
          </View>
        )}

        {taxAmount > 0 && (
          <View style={styles.totalRow}>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary },
              ]}
            >
              {t('invoices.doc.tax', { rate: data.taxRate || '0' })}
            </Text>
            <Text
              style={[
                theme.typography.bodySemiBold,
                styles.tabular,
                { color: theme.colors.text },
              ]}
              testID="live-tax-val"
            >
              {formatCurrency(taxAmount, data.currency)}
            </Text>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.totalRow}>
          <Text
            style={[
              theme.typography.h3,
              { color: theme.colors.text },
            ]}
          >
            {t('invoices.doc.total')}
          </Text>
          <Text
            style={[
              theme.typography.h2,
              styles.tabular,
              { color: theme.colors.text },
            ]}
            testID="live-total-val"
          >
            {formatCurrency(total, data.currency)}
          </Text>
        </View>
      </View>

      {/* Notes & Terms */}
      <TextField
        label={t('invoices.editor.notesLabel')}
        value={data.notes ?? ''}
        onChangeText={(text) => onChange({ notes: text })}
        multiline
        numberOfLines={3}
        placeholder={t('invoices.editor.notesPlaceholder')}
        editable={!disabled}
        testID="invoice-notes-input"
      />

      <TextField
        label={t('invoices.editor.termsLabel')}
        value={data.terms ?? ''}
        onChangeText={(text) => onChange({ terms: text })}
        multiline
        numberOfLines={3}
        placeholder={t('invoices.doc.terms')}
        editable={!disabled}
        testID="invoice-terms-input"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    width: '100%',
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
  },
  lineItemCard: {
    padding: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 10,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyRateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  qtyCol: {
    flex: 1,
  },
  rateCol: {
    flex: 1,
  },
  lineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  adjustmentsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  adjCol: {
    flex: 1,
  },
  totalsCard: {
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    padding: 10,
    borderWidth: 1,
  },
});
