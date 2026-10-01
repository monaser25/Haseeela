import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Building2, User } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { TextField } from '../ui';
import { DatePickerField } from '../transactions/DatePickerField';

export interface ClientFormFieldsProps {
  testIDPrefix: string;
  name: string;
  onChangeName: (text: string) => void;
  revenueStr: string;
  onChangeRevenueStr: (text: string) => void;
  company: string;
  onChangeCompany: (text: string) => void;
  email: string;
  onChangeEmail: (text: string) => void;
  clientType: 'COMPANY' | 'INDIVIDUAL';
  onChangeClientType: (type: 'COMPANY' | 'INDIVIDUAL') => void;
  status: 'ACTIVE' | 'PROSPECT' | 'COMPLETED' | 'INACTIVE';
  onChangeStatus: (status: 'ACTIVE' | 'PROSPECT' | 'COMPLETED' | 'INACTIVE') => void;
  paymentType: 'onetime' | 'retainer';
  onChangePaymentType: (type: 'onetime' | 'retainer') => void;
  paymentDate: Date;
  onChangePaymentDate: (date: Date) => void;
  billingDayStr: string;
  onChangeBillingDayStr: (text: string) => void;
  nextBillingDate: Date;
  onChangeNextBillingDate: (date: Date) => void;
  currency: string;
  fieldErrors: Record<string, string>;
  disabled?: boolean;
}

export function ClientFormFields({
  testIDPrefix,
  name,
  onChangeName,
  revenueStr,
  onChangeRevenueStr,
  company,
  onChangeCompany,
  email,
  onChangeEmail,
  clientType,
  onChangeClientType,
  status,
  onChangeStatus,
  paymentType,
  onChangePaymentType,
  paymentDate,
  onChangePaymentDate,
  billingDayStr,
  onChangeBillingDayStr,
  nextBillingDate,
  onChangeNextBillingDate,
  currency,
  fieldErrors,
  disabled = false,
}: ClientFormFieldsProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      {/* Client Type Toggle */}
      <View style={styles.section}>
        <Text
          style={[
            theme.typography.captionUpper,
            styles.fieldLabel,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('clients.form.clientTypeLabel')}
        </Text>
        <View style={styles.segmentContainer}>
          <Pressable
            testID={`${testIDPrefix}-type-company`}
            accessibilityRole="button"
            accessibilityState={{ selected: clientType === 'COMPANY' }}
            disabled={disabled}
            onPress={() => onChangeClientType('COMPANY')}
            style={({ pressed }) => [
              styles.segmentBtn,
              {
                backgroundColor:
                  clientType === 'COMPANY' ? theme.colors.accent : theme.colors.surfaceHover,
                opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Building2
              size={16}
              color={clientType === 'COMPANY' ? theme.colors.accentFg : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    clientType === 'COMPANY' ? theme.colors.accentFg : theme.colors.textSecondary,
                  fontWeight: clientType === 'COMPANY' ? '700' : '500',
                },
              ]}
            >
              {t('clients.form.typeCompany')}
            </Text>
          </Pressable>

          <Pressable
            testID={`${testIDPrefix}-type-individual`}
            accessibilityRole="button"
            accessibilityState={{ selected: clientType === 'INDIVIDUAL' }}
            disabled={disabled}
            onPress={() => onChangeClientType('INDIVIDUAL')}
            style={({ pressed }) => [
              styles.segmentBtn,
              {
                backgroundColor:
                  clientType === 'INDIVIDUAL' ? theme.colors.accent : theme.colors.surfaceHover,
                opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <User
              size={16}
              color={clientType === 'INDIVIDUAL' ? theme.colors.accentFg : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    clientType === 'INDIVIDUAL' ? theme.colors.accentFg : theme.colors.textSecondary,
                  fontWeight: clientType === 'INDIVIDUAL' ? '700' : '500',
                },
              ]}
            >
              {t('clients.form.typeIndividual')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Name Input */}
      <TextField
        label={t('clients.form.nameLabel')}
        value={name}
        onChangeText={onChangeName}
        placeholder={t('clients.form.nameLabel')}
        error={fieldErrors.name}
        editable={!disabled}
        testID={`${testIDPrefix}-name-input`}
      />

      {/* Revenue Input */}
      <View style={styles.fieldWrapper}>
        <TextField
          label={`${t('clients.form.amountLabel')} (${currency})`}
          value={revenueStr}
          onChangeText={onChangeRevenueStr}
          placeholder="0.00"
          keyboardType="decimal-pad"
          error={fieldErrors.revenue}
          editable={!disabled}
          testID={`${testIDPrefix}-revenue-input`}
        />
        <Text
          style={[
            theme.typography.caption,
            styles.helperText,
            { color: theme.colors.textMuted },
          ]}
          testID={`${testIDPrefix}-revenue-helper`}
        >
          {t('clients.form.blankRevenueHelper')}
        </Text>
      </View>

      {/* Company Input */}
      <TextField
        label={t('clients.form.companyLabel')}
        value={company}
        onChangeText={onChangeCompany}
        placeholder={t('clients.form.companyLabel')}
        error={fieldErrors.company}
        editable={!disabled}
        testID={`${testIDPrefix}-company-input`}
      />

      {/* Email Input */}
      <TextField
        label={t('clients.form.emailLabel')}
        value={email}
        onChangeText={onChangeEmail}
        placeholder="client@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={fieldErrors.email}
        editable={!disabled}
        testID={`${testIDPrefix}-email-input`}
      />

      {/* Status Selection */}
      <View style={styles.section}>
        <Text
          style={[
            theme.typography.captionUpper,
            styles.fieldLabel,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('clients.form.statusLabel')}
        </Text>
        <View style={styles.chipRow}>
          {(['ACTIVE', 'PROSPECT', 'COMPLETED', 'INACTIVE'] as const).map((s) => {
            const isSelected = status === s;
            const label =
              s === 'ACTIVE'
                ? t('clients.form.statusActive')
                : s === 'PROSPECT'
                ? t('clients.form.statusProspect')
                : s === 'COMPLETED'
                ? t('clients.form.statusCompleted')
                : t('clients.form.statusInactive');
            return (
              <Pressable
                key={s}
                testID={`${testIDPrefix}-status-${s.toLowerCase()}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                disabled={disabled}
                onPress={() => onChangeStatus(s)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.colors.accent : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                    opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? theme.colors.accentFg : theme.colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
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

      {/* Payment Type Selection */}
      <View style={styles.section}>
        <Text
          style={[
            theme.typography.captionUpper,
            styles.fieldLabel,
            { color: theme.colors.textMuted },
          ]}
        >
          {t('clients.form.paymentTypeLabel')}
        </Text>
        <View style={styles.segmentContainer}>
          <Pressable
            testID={`${testIDPrefix}-payment-onetime`}
            accessibilityRole="button"
            accessibilityState={{ selected: paymentType === 'onetime' }}
            disabled={disabled}
            onPress={() => onChangePaymentType('onetime')}
            style={({ pressed }) => [
              styles.segmentBtn,
              {
                backgroundColor:
                  paymentType === 'onetime' ? theme.colors.accent : theme.colors.surfaceHover,
                opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    paymentType === 'onetime' ? theme.colors.accentFg : theme.colors.textSecondary,
                  fontWeight: paymentType === 'onetime' ? '700' : '500',
                },
              ]}
            >
              {t('clients.form.paymentOneTime')}
            </Text>
          </Pressable>

          <Pressable
            testID={`${testIDPrefix}-payment-retainer`}
            accessibilityRole="button"
            accessibilityState={{ selected: paymentType === 'retainer' }}
            disabled={disabled}
            onPress={() => onChangePaymentType('retainer')}
            style={({ pressed }) => [
              styles.segmentBtn,
              {
                backgroundColor:
                  paymentType === 'retainer' ? theme.colors.accent : theme.colors.surfaceHover,
                opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    paymentType === 'retainer' ? theme.colors.accentFg : theme.colors.textSecondary,
                  fontWeight: paymentType === 'retainer' ? '700' : '500',
                },
              ]}
            >
              {t('clients.form.paymentRetainer')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Conditional Date / Retainer Fields */}
      {paymentType === 'onetime' ? (
        <DatePickerField
          label={t('clients.form.paymentDateLabel')}
          value={paymentDate}
          onChange={onChangePaymentDate}
          disabled={disabled}
          testID={`${testIDPrefix}-payment-date-picker`}
        />
      ) : (
        <View style={styles.retainerFields}>
          <TextField
            label={t('clients.form.billingDayLabel')}
            value={billingDayStr}
            onChangeText={onChangeBillingDayStr}
            placeholder="1"
            keyboardType="number-pad"
            error={fieldErrors.billingDay}
            editable={!disabled}
            testID={`${testIDPrefix}-billing-day-input`}
          />

          <DatePickerField
            label={t('clients.form.nextBillingLabel')}
            value={nextBillingDate}
            onChange={onChangeNextBillingDate}
            disabled={disabled}
            testID={`${testIDPrefix}-next-billing-date-picker`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  section: {
    gap: 8,
    marginBottom: 4,
  },
  fieldLabel: {
    marginBottom: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    gap: 8,
    paddingHorizontal: 12,
  },
  segmentText: {
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
  },
  retainerFields: {
    gap: 12,
  },
  fieldWrapper: {
    gap: 4,
  },
  helperText: {
    marginTop: -8,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
});
