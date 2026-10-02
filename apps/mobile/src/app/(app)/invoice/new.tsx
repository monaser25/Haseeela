import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { CurrencyCode } from '@haseela/shared';
import { X, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useOverview, usePreferences } from '../../../api';
import { useCreateInvoice } from '../../../api/invoiceHooks';
import { useIsOnline } from '../../../query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import {
  InvoiceFormFields,
  validateInvoiceForm,
  type InvoiceFormData,
  type InvoiceFormErrors,
} from '../../../components/invoices';
import { formatCalendarDate } from '../../../utils/calendarDate';
import { parseLocaleAmount } from '../../../components/transactions/parseAmount';

export default function NewInvoiceScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const { data: overview, isLoading: isOverviewLoading } = useOverview();
  const { data: preferences } = usePreferences();
  const defaultCurrency: CurrencyCode = preferences?.currency || 'USD';

  const clients = useMemo(() => overview?.clients ?? [], [overview]);

  const [formData, setFormData] = useState<InvoiceFormData>(() => {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    return {
      number: '',
      clientId: null,
      currency: defaultCurrency,
      issueDate: today,
      dueDate: thirtyDaysLater,
      taxRate: '',
      discount: '',
      notes: '',
      terms: '',
      lineItems: [
        {
          description: '',
          quantity: '1',
          rate: '',
        },
      ],
    };
  });

  const [errors, setErrors] = useState<InvoiceFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const createInvoiceMutation = useCreateInvoice();
  const isSaving = createInvoiceMutation.isPending;

  const handleFieldChange = useCallback((updates: Partial<InvoiceFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setServerError(null);
  }, []);

  const handleLineItemChange = useCallback(
    (index: number, updates: Partial<InvoiceFormData['lineItems'][0]>) => {
      setFormData((prev) => {
        const nextItems = [...prev.lineItems];
        nextItems[index] = { ...nextItems[index], ...updates };
        return { ...prev, lineItems: nextItems };
      });
      setServerError(null);
    },
    []
  );

  const handleAddLineItem = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: '', quantity: '1', rate: '' },
      ],
    }));
  }, []);

  const handleRemoveLineItem = useCallback((index: number) => {
    setFormData((prev) => {
      if (prev.lineItems.length <= 1) return prev;
      const nextItems = prev.lineItems.filter((_, i) => i !== index);
      return { ...prev, lineItems: nextItems };
    });
  }, []);

  const handleSaveDraft = async () => {
    if (!isOnline || isSaving) return;

    const validation = validateInvoiceForm(formData, t);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setServerError(null);

    // Prepare payload matching InvoiceSchema
    const lineItemsPayload = formData.lineItems.map((li) => ({
      description: li.description.trim(),
      quantity: parseLocaleAmount(li.quantity),
      rate: parseLocaleAmount(li.rate),
    }));

    const taxRateNum = formData.taxRate ? parseLocaleAmount(formData.taxRate) : 0;
    const discountNum = formData.discount ? parseLocaleAmount(formData.discount) : 0;

    const payload = {
      number: formData.number?.trim() || undefined,
      clientId: formData.clientId || null,
      currency: formData.currency,
      issueDate: formatCalendarDate(formData.issueDate),
      dueDate: formatCalendarDate(formData.dueDate),
      status: 'DRAFT' as const,
      taxRate: Number.isNaN(taxRateNum) ? 0 : taxRateNum,
      discount: Number.isNaN(discountNum) ? 0 : discountNum,
      notes: formData.notes?.trim() || null,
      terms: formData.terms?.trim() || null,
      lineItems: lineItemsPayload,
    };

    try {
      const created = await createInvoiceMutation.mutateAsync(payload);
      // Navigate to detail only after real server response
      router.replace(`/(app)/invoice/${created.id}` as any);
    } catch {
      setServerError(t('invoices.editor.errorFailedSave'));
    }
  };

  const handleCancel = () => {
    if (isSaving) return;
    router.back();
  };

  return (
    <ScreenContainer testID="new-invoice-screen" edges={['top', 'left', 'right', 'bottom']} scrollable={false} padded={false}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('invoices.editor.back')}
          onPress={handleCancel}
          disabled={isSaving}
          hitSlop={8}
          style={styles.iconButton}
          testID="new-invoice-cancel-btn"
        >
          <X size={22} color={theme.colors.text} />
        </Pressable>

        <Text
          accessibilityRole="header"
          style={[theme.typography.h2, styles.headerTitle, { color: theme.colors.text }]}
          testID="new-invoice-header-title"
        >
          {t('invoices.editor.newTitle')}
        </Text>

        <Button
          variant="primary"
          onPress={handleSaveDraft}
          loading={isSaving}
          disabled={isSaving || !isOnline}
          testID="new-invoice-save-draft-btn"
        >
          {t('invoices.editor.saveDraft')}
        </Button>
      </View>

      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="warning"
            message={t('invoices.offline.readOnly')}
            testID="new-invoice-offline-banner"
          />
        </View>
      )}

      {/* Server error banner */}
      {Boolean(serverError) && (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="error"
            message={serverError!}
            testID="new-invoice-server-error-banner"
          />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isOverviewLoading && !overview ? (
            <ActivityIndicator size="large" color={theme.colors.accent} style={styles.loader} />
          ) : (
            <InvoiceFormFields
              data={formData}
              errors={errors}
              clients={clients}
              disabled={isSaving || !isOnline}
              onChange={handleFieldChange}
              onLineItemChange={handleLineItemChange}
              onAddLineItem={handleAddLineItem}
              onRemoveLineItem={handleRemoveLineItem}
              testID="new-invoice-fields"
            />
          )}

          <View style={styles.bottomActions}>
            <Button
              variant="primary"
              onPress={handleSaveDraft}
              loading={isSaving}
              disabled={isSaving || !isOnline}
              testID="new-invoice-bottom-save-btn"
            >
              {t('invoices.editor.saveDraft')}
            </Button>
            <Button
              variant="secondary"
              onPress={handleCancel}
              disabled={isSaving}
              testID="new-invoice-bottom-cancel-btn"
            >
              {t('invoices.send.cancel')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginStart: 8,
  },
  bannerWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  loader: {
    paddingVertical: 32,
  },
  bottomActions: {
    gap: 10,
    marginTop: 12,
  },
});
