import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Wallet, ArrowRight, ArrowLeft } from 'lucide-react-native';
import { CurrencyCode, computeNextBillingDate } from '@haseela/shared';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { useAuth } from '../../auth';
import {
  usePreferences,
  useUpdatePreferences,
  useCreateClient,
  useCreateSubscription,
} from '../../api';
import { Button, TextField, ScreenContainer } from '../../components/ui';

const TOTAL_STEPS = 5;

const CURRENCIES: { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();

  const { data: preferences } = usePreferences();
  const updatePreferencesMutation = useUpdatePreferences();
  const createClientMutation = useCreateClient();
  const createSubMutation = useCreateSubscription();

  const [step, setStep] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(
    () => preferences?.currency || 'USD'
  );

  // Client step state
  const [clientName, setClientName] = useState('');
  const [clientRevenue, setClientRevenue] = useState('');
  const [clientPaymentType, setClientPaymentType] = useState<'onetime' | 'retainer'>('onetime');
  const [clientAdded, setClientAdded] = useState(false);

  // Tool / subscription step state
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subCycle, setSubCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [subAdded, setSubAdded] = useState(false);

  const [isBusy, setIsBusy] = useState(false);

  const displayName =
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    t('onboarding.welcome.fallback_name');

  const handleFinishOrSkipAll = async () => {
    setIsBusy(true);
    try {
      await updatePreferencesMutation.mutateAsync({
        onboardedAt: new Date().toISOString(),
      });
      router.replace('/(app)/(tabs)');
    } catch {
      router.replace('/(app)/(tabs)');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCurrencySelect = async (code: CurrencyCode) => {
    setSelectedCurrency(code);
    try {
      await updatePreferencesMutation.mutateAsync({ currency: code });
    } catch {
      // non-blocking
    }
  };

  const handleSaveClient = async () => {
    const trimmedName = clientName.trim();
    const parsedRev = parseFloat(clientRevenue);
    if (!trimmedName || isNaN(parsedRev) || parsedRev <= 0) {
      return;
    }

    setIsBusy(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await createClientMutation.mutateAsync({
        name: trimmedName,
        revenue: parsedRev,
        clientType: 'COMPANY',
        status: 'ACTIVE',
        paymentType: clientPaymentType,
        paymentDate: clientPaymentType === 'onetime' ? todayStr : undefined,
        nextBillingDate:
          clientPaymentType === 'retainer'
            ? computeNextBillingDate(new Date().getDate())
            : undefined,
        billingDay: clientPaymentType === 'retainer' ? new Date().getDate() : undefined,
      });
      setClientAdded(true);
      setStep(3);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveSubscription = async () => {
    const trimmedName = subName.trim();
    const parsedAmount = parseFloat(subAmount);
    if (!trimmedName || isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setIsBusy(true);
    try {
      await createSubMutation.mutateAsync({
        name: trimmedName,
        amount: parsedAmount,
        cycle: subCycle,
        billingCycle: subCycle,
        billingDay: new Date().getDate(),
        nextBillingDate: computeNextBillingDate(new Date().getDate()),
        status: 'ACTIVE',
      });
      setSubAdded(true);
      setStep(4);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ScreenContainer
      testID="onboarding-screen"
      showOfflineBanner={false}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.container}>
        {/* Top Progress Bar & Skip Button */}
        <View style={styles.topBar}>
          <View
            style={styles.progressDots}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={t('onboarding.progress.step', {
              step: String(step + 1),
              total: String(TOTAL_STEPS),
            })}
            testID="onboarding-progress"
          >
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: i === step ? 20 : 6,
                    backgroundColor:
                      i <= step ? theme.colors.accent : theme.colors.borderStrong,
                  },
                ]}
              />
            ))}
          </View>

          {step < 4 ? (
            <TouchableOpacity
              onPress={handleFinishOrSkipAll}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skip')}
              testID="onboarding-skip-all"
            >
              <Text
                style={[
                  theme.typography.bodyMedium,
                  { color: theme.colors.textMuted },
                ]}
              >
                {t('onboarding.skip')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <View style={styles.stepContent} testID="onboarding-step-welcome">
            <View
              style={[
                styles.brandIconCircle,
                { backgroundColor: theme.colors.accentTint },
              ]}
            >
              <Wallet size={48} color={theme.colors.accent} />
            </View>

            <View style={styles.textBlock}>
              <Text
                accessibilityRole="header"
                style={[theme.typography.title, styles.stepTitle, { color: theme.colors.text }]}
              >
                {t('onboarding.welcome.title', { name: displayName })}
              </Text>
              <Text
                style={[theme.typography.body, styles.stepSubtitle, { color: theme.colors.textSecondary }]}
              >
                {t('onboarding.welcome.sub')}
              </Text>
            </View>

            <Button
              variant="primary"
              onPress={() => setStep(1)}
              style={styles.fullButton}
              testID="onboarding-welcome-start"
            >
              {t('onboarding.welcome.start')}
            </Button>
          </View>
        )}

        {/* Step 1: Currency */}
        {step === 1 && (
          <View style={styles.stepContent} testID="onboarding-step-currency">
            <View style={styles.textBlock}>
              <Text
                accessibilityRole="header"
                style={[theme.typography.title, styles.stepTitle, { color: theme.colors.text }]}
              >
                {t('onboarding.currency.title')}
              </Text>
              <Text
                style={[theme.typography.body, styles.stepSubtitle, { color: theme.colors.textSecondary }]}
              >
                {t('onboarding.currency.sub')}
              </Text>
            </View>

            <View style={styles.currencyGrid}>
              {CURRENCIES.map((c) => {
                const isSelected = selectedCurrency === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => handleCurrencySelect(c.code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${c.name} (${c.code})`}
                    style={[
                      styles.currencyCard,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accentTint
                          : theme.colors.surface,
                        borderColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.border,
                        borderRadius: theme.radius.md,
                      },
                    ]}
                    testID={`currency-option-${c.code}`}
                  >
                    <Text
                      style={[
                        theme.typography.h2,
                        {
                          color: isSelected
                            ? theme.colors.accent
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {c.symbol}
                    </Text>
                    <Text
                      style={[
                        theme.typography.small,
                        {
                          color: isSelected
                            ? theme.colors.accent
                            : theme.colors.textSecondary,
                        },
                      ]}
                    >
                      {c.code} · {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              variant="primary"
              onPress={() => setStep(2)}
              style={styles.fullButton}
              testID="onboarding-currency-continue"
            >
              {t('onboarding.currency.continue')}
            </Button>
          </View>
        )}

        {/* Step 2: First Client */}
        {step === 2 && (
          <View style={styles.stepContent} testID="onboarding-step-client">
            <View style={styles.textBlock}>
              <Text
                accessibilityRole="header"
                style={[theme.typography.title, styles.stepTitle, { color: theme.colors.text }]}
              >
                {t('onboarding.client.title')}
              </Text>
              <Text
                style={[theme.typography.body, styles.stepSubtitle, { color: theme.colors.textSecondary }]}
              >
                {t('onboarding.client.sub')}
              </Text>
            </View>

            <View style={styles.formFields}>
              <TextField
                label={t('onboarding.client.name_label')}
                placeholder={t('onboarding.client.name_placeholder')}
                value={clientName}
                onChangeText={setClientName}
                testID="onboarding-client-name"
              />

              <TextField
                label={t('onboarding.client.amount_label')}
                placeholder="2500"
                value={clientRevenue}
                onChangeText={setClientRevenue}
                keyboardType="decimal-pad"
                testID="onboarding-client-amount"
              />

              {/* Payment Type Selection */}
              <View style={styles.paymentTypeRow}>
                <Pressable
                  onPress={() => setClientPaymentType('onetime')}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor:
                        clientPaymentType === 'onetime'
                          ? theme.colors.accentTint
                          : theme.colors.surface,
                      borderColor:
                        clientPaymentType === 'onetime'
                          ? theme.colors.accent
                          : theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: clientPaymentType === 'onetime' }}
                  testID="client-type-onetime"
                >
                  <Text
                    style={[
                      theme.typography.bodyMedium,
                      {
                        color:
                          clientPaymentType === 'onetime'
                            ? theme.colors.accent
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {t('onboarding.client.payment_type_onetime')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setClientPaymentType('retainer')}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor:
                        clientPaymentType === 'retainer'
                          ? theme.colors.accentTint
                          : theme.colors.surface,
                      borderColor:
                        clientPaymentType === 'retainer'
                          ? theme.colors.accent
                          : theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: clientPaymentType === 'retainer' }}
                  testID="client-type-retainer"
                >
                  <Text
                    style={[
                      theme.typography.bodyMedium,
                      {
                        color:
                          clientPaymentType === 'retainer'
                            ? theme.colors.accent
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {t('onboarding.client.payment_type_retainer')}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.actionColumn}>
              <Button
                variant="primary"
                onPress={handleSaveClient}
                loading={isBusy}
                disabled={!clientName.trim() || !clientRevenue.trim()}
                style={styles.fullButton}
                testID="onboarding-client-add"
              >
                {t('onboarding.client.add')}
              </Button>

              <Button
                variant="secondary"
                onPress={() => setStep(3)}
                style={styles.fullButton}
                testID="onboarding-client-skip"
              >
                {t('onboarding.client.skip')}
              </Button>
            </View>
          </View>
        )}

        {/* Step 3: First Tool / Subscription */}
        {step === 3 && (
          <View style={styles.stepContent} testID="onboarding-step-tool">
            <View style={styles.textBlock}>
              <Text
                accessibilityRole="header"
                style={[theme.typography.title, styles.stepTitle, { color: theme.colors.text }]}
              >
                {t('onboarding.tool.title')}
              </Text>
              <Text
                style={[theme.typography.body, styles.stepSubtitle, { color: theme.colors.textSecondary }]}
              >
                {t('onboarding.tool.sub')}
              </Text>
            </View>

            <View style={styles.formFields}>
              <TextField
                label={t('onboarding.tool.name_label')}
                placeholder={t('onboarding.tool.name_placeholder')}
                value={subName}
                onChangeText={setSubName}
                testID="onboarding-tool-name"
              />

              <TextField
                label={t('onboarding.tool.cost_label')}
                placeholder="20"
                value={subAmount}
                onChangeText={setSubAmount}
                keyboardType="decimal-pad"
                testID="onboarding-tool-cost"
              />

              {/* Cycle selection */}
              <View style={styles.cycleRow}>
                {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((cycle) => {
                  const isSelected = subCycle === cycle;
                  const label =
                    cycle === 'MONTHLY'
                      ? t('onboarding.tool.cycle_monthly')
                      : cycle === 'QUARTERLY'
                      ? t('onboarding.tool.cycle_quarterly')
                      : t('onboarding.tool.cycle_yearly');
                  return (
                    <Pressable
                      key={cycle}
                      onPress={() => setSubCycle(cycle)}
                      style={[
                        styles.cycleChip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.accentTint
                            : theme.colors.surface,
                          borderColor: isSelected
                            ? theme.colors.accent
                            : theme.colors.border,
                          borderRadius: theme.radius.md,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      testID={`tool-cycle-${cycle.toLowerCase()}`}
                    >
                      <Text
                        style={[
                          theme.typography.smallMedium,
                          {
                            color: isSelected
                              ? theme.colors.accent
                              : theme.colors.text,
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

            <View style={styles.actionColumn}>
              <Button
                variant="primary"
                onPress={handleSaveSubscription}
                loading={isBusy}
                disabled={!subName.trim() || !subAmount.trim()}
                style={styles.fullButton}
                testID="onboarding-tool-add"
              >
                {t('onboarding.tool.add')}
              </Button>

              <Button
                variant="secondary"
                onPress={() => setStep(4)}
                style={styles.fullButton}
                testID="onboarding-tool-skip"
              >
                {t('onboarding.tool.skip')}
              </Button>
            </View>
          </View>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <View style={styles.stepContent} testID="onboarding-step-done">
            <View
              style={[
                styles.brandIconCircle,
                { backgroundColor: theme.colors.positiveTint },
              ]}
            >
              <Check size={48} color={theme.colors.positive} />
            </View>

            <View style={styles.textBlock}>
              <Text
                accessibilityRole="header"
                style={[theme.typography.title, styles.stepTitle, { color: theme.colors.text }]}
              >
                {t('onboarding.done.title')}
              </Text>
              <Text
                style={[theme.typography.body, styles.stepSubtitle, { color: theme.colors.textSecondary }]}
              >
                {t('onboarding.done.sub')}
              </Text>
            </View>

            {/* Summary List */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}
            >
              <View style={styles.summaryRow}>
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('onboarding.done.summary_currency')}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    { color: theme.colors.text },
                  ]}
                >
                  {selectedCurrency}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryRow,
                  { borderTopWidth: 1, borderTopColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('onboarding.done.summary_client')}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    {
                      color: clientAdded
                        ? theme.colors.positiveText
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {clientAdded
                    ? t('onboarding.done.summary_added')
                    : t('onboarding.done.summary_skipped')}
                </Text>
              </View>

              <View
                style={[
                  styles.summaryRow,
                  { borderTopWidth: 1, borderTopColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {t('onboarding.done.summary_tool')}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySemiBold,
                    {
                      color: subAdded
                        ? theme.colors.positiveText
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {subAdded
                    ? t('onboarding.done.summary_added')
                    : t('onboarding.done.summary_skipped')}
                </Text>
              </View>
            </View>

            <Button
              variant="primary"
              onPress={handleFinishOrSkipAll}
              loading={isBusy}
              style={styles.fullButton}
              testID="onboarding-done-finish"
            >
              {t('onboarding.done.finish')}
            </Button>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    minHeight: 48,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  skipButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  stepContent: {
    paddingVertical: 24,
    gap: 24,
  },
  brandIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: 12,
  },
  textBlock: {
    gap: 8,
    alignItems: 'center',
  },
  stepTitle: {
    textAlign: 'center',
  },
  stepSubtitle: {
    textAlign: 'center',
    maxWidth: 360,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  currencyCard: {
    width: '47%',
    padding: 16,
    borderWidth: 1.5,
    gap: 4,
    minHeight: 76,
    justifyContent: 'center',
  },
  formFields: {
    gap: 16,
  },
  paymentTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cycleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cycleChip: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionColumn: {
    gap: 12,
    marginTop: 8,
  },
  summaryCard: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  fullButton: {
    width: '100%',
  },
});
