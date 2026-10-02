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
import { computeNextBillingDate } from '@haseela/shared';
import { X } from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { usePreferences, useCreateSubscription } from '../../../api';
import { useIsOnline } from '../../../query';
import { onlineManager } from '@tanstack/react-query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import { parseCalendarDate } from '../../../utils/calendarDate';
import {
  SubscriptionFormFields,
  validateSubscriptionFormInput,
  parseLocalizedBillingDay,
} from '../../../components/subscriptions';

export default function NewSubscriptionScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const { data: preferences } = usePreferences();
  const currency = preferences?.currency || 'USD';

  const createMutation = useCreateSubscription();

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [cycle, setCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');

  const initialBillingDay = Math.max(1, Math.min(28, new Date().getDate()));
  const [billingDayStr, setBillingDayStr] = useState(String(initialBillingDay));
  const [nextBillingDate, setNextBillingDate] = useState<Date>(() =>
    parseCalendarDate(computeNextBillingDate(initialBillingDay))
  );
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [notes, setNotes] = useState('');

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

    const validation = validateSubscriptionFormInput(
      {
        name,
        amountStr,
        cycle,
        billingDayStr,
        nextBillingDate,
        status,
        notes,
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
      setGeneralError(err instanceof Error ? err.message : t('subscriptions.error.generic'));
    }
  };

  return (
    <ScreenContainer testID="subscription-new-screen" edges={['top', 'bottom', 'left', 'right']} scrollable={false} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text
            accessibilityRole="header"
            style={[theme.typography.h3, styles.headerTitle, { color: theme.colors.text }]}
          >
            {t('subscriptions.form.addTitle')}
          </Text>
          <Pressable
            testID="subscription-cancel-button"
            accessibilityRole="button"
            accessibilityLabel={t('subscriptions.form.cancel')}
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
              message={t('subscriptions.offline.saveDisabled')}
            />
          )}

          {Boolean(generalError) && (
            <Banner tone="error" message={generalError ?? undefined} />
          )}

          <SubscriptionFormFields
            testIDPrefix="subscription"
            name={name}
            onChangeName={setName}
            amountStr={amountStr}
            onChangeAmountStr={setAmountStr}
            cycle={cycle}
            onChangeCycle={setCycle}
            billingDayStr={billingDayStr}
            onChangeBillingDayStr={handleBillingDayChange}
            nextBillingDate={nextBillingDate}
            onChangeNextBillingDate={setNextBillingDate}
            status={status}
            onChangeStatus={setStatus}
            notes={notes}
            onChangeNotes={setNotes}
            currency={currency}
            fieldErrors={fieldErrors}
            disabled={createMutation.isPending}
            isEdit={false}
          />

          <Button
            variant="primary"
            onPress={handleSave}
            loading={createMutation.isPending}
            disabled={!isOnline || createMutation.isPending}
            style={styles.saveBtn}
            testID="subscription-save-button"
          >
            {createMutation.isPending
              ? t('subscriptions.form.saving')
              : t('subscriptions.form.save')}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
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
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  saveBtn: {
    marginTop: 8,
  },
});
