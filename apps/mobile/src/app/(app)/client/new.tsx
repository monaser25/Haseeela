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
import { useRouter } from 'expo-router';
import { ClientSchema, computeNextBillingDate } from '@haseela/shared';
import { X } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { usePreferences, useCreateClient } from '../../../api';
import { useIsOnline } from '../../../query';
import { onlineManager } from '@tanstack/react-query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import { formatCalendarDate, parseCalendarDate } from '../../../utils/calendarDate';
import {
  ClientFormFields,
  validateClientFormInput,
  parseLocalizedBillingDay,
} from '../../../components/clients';

export default function NewClientScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';

  const createMutation = useCreateClient();

  const [name, setName] = useState('');
  const [revenueStr, setRevenueStr] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [clientType, setClientType] = useState<'COMPANY' | 'INDIVIDUAL'>('COMPANY');
  const [status, setStatus] = useState<'ACTIVE' | 'PROSPECT' | 'COMPLETED' | 'INACTIVE'>('ACTIVE');
  const [paymentType, setPaymentType] = useState<'onetime' | 'retainer'>('onetime');
  const [paymentDate, setPaymentDate] = useState<Date>(() => new Date());

  const initialBillingDay = Math.max(1, Math.min(28, new Date().getDate()));
  const [billingDayStr, setBillingDayStr] = useState(String(initialBillingDay));
  const [nextBillingDate, setNextBillingDate] = useState<Date>(() =>
    parseCalendarDate(computeNextBillingDate(initialBillingDay))
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleBillingDayChange = (text: string) => {
    setBillingDayStr(text);
    const parsed = parseLocalizedBillingDay(text);
    if (parsed.value != null) {
      setNextBillingDate(parseCalendarDate(computeNextBillingDate(parsed.value)));
    }
  };

  const handleSave = async () => {
    if (!isOnline || !onlineManager.isOnline() || createMutation.isPending) return;

    setFieldErrors({});
    setGeneralError(null);

    const validation = validateClientFormInput(
      {
        name,
        revenueStr,
        company,
        email,
        clientType,
        status,
        paymentType,
        paymentDate,
        billingDayStr,
        nextBillingDate,
      },
      t as any,
      false
    );

    if (!validation.valid || !validation.payload) {
      setFieldErrors(validation.errors);
      return;
    }

    try {
      await createMutation.mutateAsync(validation.payload);
      router.back();
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('clients.error.generic'));
    }
  };

  return (
    <ScreenContainer testID="client-new-screen" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text
            accessibilityRole="header"
            style={[theme.typography.h3, styles.headerTitle, { color: theme.colors.text }]}
          >
            {t('clients.form.addTitle')}
          </Text>
          <Pressable
            testID="client-cancel-button"
            accessibilityRole="button"
            accessibilityLabel={t('clients.form.cancel')}
            onPress={() => router.back()}
            hitSlop={8}
            style={[styles.closeButton, { backgroundColor: theme.colors.surfaceHover }]}
          >
            <X size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!isOnline && (
            <Banner
              tone="warning"
              message={t('clients.offline.saveDisabled')}
            />
          )}

          {Boolean(generalError) && (
            <Banner tone="error" message={generalError ?? undefined} />
          )}

          <ClientFormFields
            testIDPrefix="client"
            name={name}
            onChangeName={setName}
            revenueStr={revenueStr}
            onChangeRevenueStr={setRevenueStr}
            company={company}
            onChangeCompany={setCompany}
            email={email}
            onChangeEmail={setEmail}
            clientType={clientType}
            onChangeClientType={setClientType}
            status={status}
            onChangeStatus={setStatus}
            paymentType={paymentType}
            onChangePaymentType={setPaymentType}
            paymentDate={paymentDate}
            onChangePaymentDate={setPaymentDate}
            billingDayStr={billingDayStr}
            onChangeBillingDayStr={handleBillingDayChange}
            nextBillingDate={nextBillingDate}
            onChangeNextBillingDate={setNextBillingDate}
            currency={currency}
            fieldErrors={fieldErrors}
            disabled={createMutation.isPending}
          />

          <Button
            variant="primary"
            onPress={handleSave}
            loading={createMutation.isPending}
            disabled={!isOnline || createMutation.isPending}
            style={styles.saveBtn}
            testID="client-save-button"
          >
            {createMutation.isPending ? t('clients.form.saving') : t('clients.form.save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  saveBtn: {
    minHeight: 48,
    marginTop: 12,
  },
});
