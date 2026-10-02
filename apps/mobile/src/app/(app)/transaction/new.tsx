import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TransactionSchema } from '@haseela/shared';
import { X, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useOverview, usePreferences, useCreateTransaction } from '../../../api';
import { useIsOnline } from '../../../query';
import { TextField, Button, Banner, ScreenContainer } from '../../../components/ui';
import { DatePickerField } from '../../../components/transactions/DatePickerField';
import { CategorySelector } from '../../../components/transactions/CategorySelector';
import { ClientSelector } from '../../../components/transactions/ClientSelector';
import { parseLocaleAmount } from '../../../components/transactions/parseAmount';
import { formatCalendarDate } from '../../../utils/calendarDate';

export default function NewTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = params.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();
  const isOnline = useIsOnline();

  const { data: overview } = useOverview();
  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';
  const clients = overview?.clients ?? [];

  const createMutation = useCreateTransaction();

  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(initialType);
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [categoryId, setCategoryId] = useState<string>(
    initialType === 'INCOME' ? 'CLIENT' : 'TOOLS'
  );
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleTypeChange = (newType: 'INCOME' | 'EXPENSE') => {
    setType(newType);
    if (newType === 'INCOME') {
      if (categoryId === 'TOOLS' || categoryId === 'OPERATIONS') {
        setCategoryId('CLIENT');
      }
    } else {
      if (categoryId === 'CLIENT' || categoryId === 'PROJECT') {
        setCategoryId('TOOLS');
      }
      setClientId(undefined);
    }
  };

  const handleSave = async () => {
    if (!isOnline || createMutation.isPending) return;

    setFieldErrors({});
    setGeneralError(null);

    const numericAmount = parseLocaleAmount(amountStr);

    const payload = {
      name: name.trim(),
      amount: numericAmount,
      type,
      status: 'COMPLETED' as const,
      date: formatCalendarDate(date),
      notes: notes.trim() || undefined,
      sourceType: 'manual' as const,
      categoryId,
      clientId: type === 'INCOME' ? clientId : undefined,
    };

    const validationResult = TransactionSchema.safeParse(payload);

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        const fieldName = err.path[0]?.toString();
        if (fieldName && !errors[fieldName]) {
          if (fieldName === 'amount' && (isNaN(numericAmount) || numericAmount <= 0)) {
            errors.amount = t('transactions.form.errorNameAmount');
          } else if (fieldName === 'name' && !name.trim()) {
            errors.name = t('transactions.form.errorNameAmount');
          } else {
            errors[fieldName] = err.message;
          }
        }
      });
      setFieldErrors(errors);
      return;
    }

    try {
      await createMutation.mutateAsync(validationResult.data);
      router.back();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('transactions.form.errorCreate'));
    }
  };

  const currencySymbol = formatCurrency(0, currency).replace(/[0-9.,\s]/g, '') || '$';

  return (
    <ScreenContainer
      testID="new-transaction-screen"
      edges={['top', 'bottom', 'left', 'right']}
      showOfflineBanner={false}
      scrollable={false}
      padded={false}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text
                style={[theme.typography.h1, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('transactions.form.addTitle')}
              </Text>
              <Text style={[theme.typography.small, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {t('transactions.form.addSubtitle')}
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('transactions.fab.close')}
              testID="new-tx-close"
              hitSlop={8}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.colors.surfaceHover },
              ]}
            >
              <X size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Offline notice */}
          {!isOnline && (
            <View style={styles.bannerSpacing}>
              <Banner
                tone="warning"
                title={t('offline.title')}
                message={t('transactions.offline.saveDisabled')}
                testID="offline-banner"
              />
            </View>
          )}

          {/* General error */}
          {generalError && (
            <View style={styles.bannerSpacing}>
              <Banner tone="error" title={generalError} testID="general-error-banner" />
            </View>
          )}

          {/* Type Toggle */}
          <View
            style={[
              styles.typeToggleContainer,
              {
                backgroundColor: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Pressable
              testID="type-toggle-income"
              accessibilityRole="button"
              accessibilityLabel={t('transactions.form.typeIncome')}
              accessibilityState={{ selected: type === 'INCOME' }}
              onPress={() => handleTypeChange('INCOME')}
              style={[
                styles.typeToggleBtn,
                type === 'INCOME'
                  ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                  : { backgroundColor: 'transparent', borderColor: 'transparent' },
              ]}
            >
              <TrendingUp
                size={18}
                color={type === 'INCOME' ? theme.colors.positiveText : theme.colors.textMuted}
              />
              <Text
                style={[
                  theme.typography.bodySemiBold,
                  {
                    color: type === 'INCOME' ? theme.colors.positiveText : theme.colors.textMuted,
                  },
                ]}
              >
                {t('transactions.form.typeIncome')}
              </Text>
            </Pressable>

            <Pressable
              testID="type-toggle-expense"
              accessibilityRole="button"
              accessibilityLabel={t('transactions.form.typeExpense')}
              accessibilityState={{ selected: type === 'EXPENSE' }}
              onPress={() => handleTypeChange('EXPENSE')}
              style={[
                styles.typeToggleBtn,
                type === 'EXPENSE'
                  ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                  : { backgroundColor: 'transparent', borderColor: 'transparent' },
              ]}
            >
              <TrendingDown
                size={18}
                color={type === 'EXPENSE' ? theme.colors.negativeText : theme.colors.textMuted}
              />
              <Text
                style={[
                  theme.typography.bodySemiBold,
                  {
                    color: type === 'EXPENSE' ? theme.colors.negativeText : theme.colors.textMuted,
                  },
                ]}
              >
                {t('transactions.form.typeExpense')}
              </Text>
            </Pressable>
          </View>

          {/* Name Field */}
          <TextField
            label={t('transactions.form.nameLabel')}
            placeholder={t('transactions.form.namePlaceholder')}
            value={name}
            onChangeText={setName}
            error={fieldErrors.name}
            testID="tx-name-input"
          />

          {/* Amount Field */}
          <TextField
            label={t('transactions.form.amountLabel')}
            placeholder="0.00"
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            error={fieldErrors.amount}
            testID="tx-amount-input"
          />

          {/* Date Picker */}
          <DatePickerField
            label={t('transactions.form.dateLabel')}
            value={date}
            onChange={setDate}
            testID="tx-date-picker"
          />

          {/* Category Selector */}
          <CategorySelector
            value={categoryId}
            onChange={setCategoryId}
            testID="tx-category-selector"
          />

          {/* Client Selector (Income only) */}
          {type === 'INCOME' && clients.length > 0 && (
            <ClientSelector
              clients={clients}
              selectedClientId={clientId}
              onChange={setClientId}
              testID="tx-client-selector"
            />
          )}

          {/* Notes */}
          <TextField
            label={t('transactions.form.notesLabel')}
            placeholder={t('transactions.form.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            testID="tx-notes-input"
          />

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Button
              variant="secondary"
              onPress={() => router.back()}
              testID="tx-cancel-button"
              style={styles.actionBtn}
            >
              {t('transactions.form.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
              disabled={!isOnline || createMutation.isPending}
              loading={createMutation.isPending}
              testID="tx-save-button"
              style={styles.actionBtn}
            >
              {createMutation.isPending
                ? t('transactions.form.saving')
                : t('transactions.form.saveTransaction')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTextCol: {
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerSpacing: {
    marginBottom: 16,
  },
  typeToggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // >= 44pt touch target
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
  },
});
