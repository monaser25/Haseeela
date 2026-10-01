import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Info, Calendar, DollarSign, Repeat, ShieldAlert } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { TextField } from '../ui';
import { DatePickerField } from '../transactions/DatePickerField';

export interface SubscriptionFormFieldsProps {
  testIDPrefix: string;
  name: string;
  onChangeName: (text: string) => void;
  amountStr: string;
  onChangeAmountStr: (text: string) => void;
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  onChangeCycle: (cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY') => void;
  billingDayStr: string;
  onChangeBillingDayStr: (text: string) => void;
  nextBillingDate: Date;
  onChangeNextBillingDate: (date: Date) => void;
  status: 'ACTIVE' | 'INACTIVE';
  onChangeStatus: (status: 'ACTIVE' | 'INACTIVE') => void;
  notes: string;
  onChangeNotes: (text: string) => void;
  currency: string;
  fieldErrors: Record<string, string>;
  disabled?: boolean;
  isEdit?: boolean;
}

export function SubscriptionFormFields({
  testIDPrefix,
  name,
  onChangeName,
  amountStr,
  onChangeAmountStr,
  cycle,
  onChangeCycle,
  billingDayStr,
  onChangeBillingDayStr,
  nextBillingDate,
  onChangeNextBillingDate,
  status,
  onChangeStatus,
  notes,
  onChangeNotes,
  currency,
  fieldErrors,
  disabled = false,
  isEdit = false,
}: SubscriptionFormFieldsProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      {/* Name Field */}
      <TextField
        testID={`${testIDPrefix}-name-input`}
        label={t('subscriptions.form.nameLabel')}
        placeholder={t('subscriptions.form.namePlaceholder')}
        value={name}
        onChangeText={onChangeName}
        error={fieldErrors.name}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {/* Amount Field */}
      <TextField
        testID={`${testIDPrefix}-amount-input`}
        label={`${t('subscriptions.form.costLabel')} (${currency})`}
        placeholder="0.00"
        value={amountStr}
        onChangeText={onChangeAmountStr}
        error={fieldErrors.amount}
        editable={!disabled}
        keyboardType="decimal-pad"
      />

      {/* Billing Cycle Selector */}
      <View style={styles.section}>
        <Text
          style={[
            theme.typography.captionUpper,
            styles.fieldLabel,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('subscriptions.form.cycleLabel')}
        </Text>
        <View style={styles.segmentContainer}>
          {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((cycleOption) => {
            const isSelected = cycle === cycleOption;
            const label =
              cycleOption === 'MONTHLY'
                ? t('subscriptions.form.cycleMonthly')
                : cycleOption === 'QUARTERLY'
                ? t('subscriptions.form.cycleQuarterly')
                : t('subscriptions.form.cycleYearly');

            return (
              <Pressable
                key={cycleOption}
                testID={`${testIDPrefix}-cycle-${cycleOption.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                disabled={disabled}
                onPress={() => onChangeCycle(cycleOption)}
                style={({ pressed }) => [
                  styles.segmentBtn,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.accent
                      : theme.colors.surfaceHover,
                    opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isSelected
                        ? theme.colors.accentFg
                        : theme.colors.textSecondary,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Billing Day Field (1-28) */}
      <TextField
        testID={`${testIDPrefix}-billing-day-input`}
        label={t('subscriptions.form.billingDayLabel')}
        placeholder="1"
        value={billingDayStr}
        onChangeText={onChangeBillingDayStr}
        error={fieldErrors.billingDay}
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={2}
      />

      {/* Next Billing Date Picker */}
      <DatePickerField
        testID={`${testIDPrefix}-next-billing-date-picker`}
        label={t('subscriptions.form.nextBillingLabel')}
        value={nextBillingDate}
        onChange={onChangeNextBillingDate}
        disabled={disabled}
      />

      {/* Status Selector */}
      <View style={styles.section}>
        <Text
          style={[
            theme.typography.captionUpper,
            styles.fieldLabel,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('subscriptions.form.statusLabel')}
        </Text>
        <View style={styles.segmentContainer}>
          {(['ACTIVE', 'INACTIVE'] as const).map((statusOption) => {
            const isSelected = status === statusOption;
            const label =
              statusOption === 'ACTIVE'
                ? t('subscriptions.form.statusActive')
                : t('subscriptions.form.statusInactive');

            return (
              <Pressable
                key={statusOption}
                testID={`${testIDPrefix}-status-${statusOption.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                disabled={disabled}
                onPress={() => onChangeStatus(statusOption)}
                style={({ pressed }) => [
                  styles.segmentBtn,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.accent
                      : theme.colors.surfaceHover,
                    opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isSelected
                        ? theme.colors.accentFg
                        : theme.colors.textSecondary,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Notes Field */}
      <TextField
        testID={`${testIDPrefix}-notes-input`}
        label={t('subscriptions.form.notesLabel')}
        placeholder={t('subscriptions.form.notesOptional')}
        value={notes}
        onChangeText={onChangeNotes}
        error={fieldErrors.notes}
        editable={!disabled}
        multiline
        numberOfLines={3}
      />

      {/* Info Card */}
      <View
        style={[
          styles.infoCard,
          {
            backgroundColor: theme.colors.infoTint,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Info size={18} color={theme.colors.info} style={styles.infoIcon} />
        <Text style={[styles.infoText, { color: theme.colors.infoText }]}>
          {t('subscriptions.form.subtitle')}
        </Text>
      </View>

      {/* Edit Mode Warning Card */}
      {isEdit && (
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.colors.warningTint,
              borderColor: theme.colors.border,
              marginTop: 10,
            },
          ]}
        >
          <ShieldAlert
            size={18}
            color={theme.colors.warning}
            style={styles.infoIcon}
          />
          <Text style={[styles.infoText, { color: theme.colors.warningText }]}>
            {t('subscriptions.form.warning')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  section: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentText: {
    fontSize: 13,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  infoIcon: {
    marginEnd: 8,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
