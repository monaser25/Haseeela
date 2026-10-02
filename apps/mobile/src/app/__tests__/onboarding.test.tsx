import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingScreen from '../(app)/onboarding';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as apiModule from '../../api';

jest.mock('../../auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'sarah@example.com', user_metadata: { name: 'Sarah' } },
    status: 'signedIn',
    signOut: jest.fn(),
  }),
}));

const mockUpdatePreferencesMutateAsync = jest.fn();
const mockCreateClientMutateAsync = jest.fn();
const mockCreateSubMutateAsync = jest.fn();

jest.mock('../../api', () => ({
  usePreferences: () => ({
    data: { currency: 'USD', onboardedAt: null },
    isLoading: false,
  }),
  useUpdatePreferences: () => ({
    mutateAsync: mockUpdatePreferencesMutateAsync,
  }),
  useCreateClient: () => ({
    mutateAsync: mockCreateClientMutateAsync,
  }),
  useCreateSubscription: () => ({
    mutateAsync: mockCreateSubMutateAsync,
  }),
}));

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: () => ({
      push: jest.fn(),
      replace: mockRouterReplace,
      back: jest.fn(),
    }),
  };
});

function renderOnboardingScreen() {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialPreference="light">
        <I18nProvider initialLocale="en">
          <OnboardingScreen />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('Onboarding Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePreferencesMutateAsync.mockResolvedValue({});
    mockCreateClientMutateAsync.mockResolvedValue({ id: 'c1' });
    mockCreateSubMutateAsync.mockResolvedValue({ id: 's1' });
  });

  it('skip-all button immediately PATCHes onboardedAt and redirects', async () => {
    const { getByTestId } = renderOnboardingScreen();
    const skipAllBtn = getByTestId('onboarding-skip-all');

    fireEvent.press(skipAllBtn);

    await waitFor(() => {
      expect(mockUpdatePreferencesMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardedAt: expect.any(String),
        })
      );
      expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/(tabs)');
    });
  });

  it('walks through entire onboarding flow and finishing PATCHes onboardedAt', async () => {
    const { getByTestId } = renderOnboardingScreen();

    // Step 0: Welcome -> press Start
    expect(getByTestId('onboarding-step-welcome')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-welcome-start'));

    // Step 1: Currency -> select EUR and press Continue
    expect(getByTestId('onboarding-step-currency')).toBeTruthy();
    fireEvent.press(getByTestId('currency-option-EUR'));
    expect(mockUpdatePreferencesMutateAsync).toHaveBeenCalledWith({ currency: 'EUR' });
    fireEvent.press(getByTestId('onboarding-currency-continue'));

    // Step 2: First client -> fill in and press Add client
    expect(getByTestId('onboarding-step-client')).toBeTruthy();
    fireEvent.changeText(getByTestId('onboarding-client-name'), 'Northwind Studio');
    fireEvent.changeText(getByTestId('onboarding-client-amount'), '3000');
    fireEvent.press(getByTestId('client-type-retainer'));
    fireEvent.press(getByTestId('onboarding-client-add'));

    await waitFor(() => {
      expect(mockCreateClientMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Northwind Studio',
          revenue: 3000,
          paymentType: 'retainer',
        })
      );
    });

    // Step 3: First tool -> fill in and press Add tool
    expect(getByTestId('onboarding-step-tool')).toBeTruthy();
    fireEvent.changeText(getByTestId('onboarding-tool-name'), 'GitHub Pro');
    fireEvent.changeText(getByTestId('onboarding-tool-cost'), '10');
    fireEvent.press(getByTestId('onboarding-tool-add'));

    await waitFor(() => {
      expect(mockCreateSubMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitHub Pro',
          amount: 10,
        })
      );
    });

    // Step 4: Done -> finish button
    expect(getByTestId('onboarding-step-done')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-done-finish'));

    await waitFor(() => {
      expect(mockUpdatePreferencesMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardedAt: expect.any(String),
        })
      );
      expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/(tabs)');
    });
  });

  it('allows skipping client and tool steps', async () => {
    const { getByTestId } = renderOnboardingScreen();

    // Welcome -> start
    fireEvent.press(getByTestId('onboarding-welcome-start'));
    // Currency -> continue
    fireEvent.press(getByTestId('onboarding-currency-continue'));

    // Client -> skip
    expect(getByTestId('onboarding-step-client')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-client-skip'));

    // Tool -> skip
    expect(getByTestId('onboarding-step-tool')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-tool-skip'));

    // Done -> finish
    expect(getByTestId('onboarding-step-done')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-done-finish'));

    await waitFor(() => {
      expect(mockCreateClientMutateAsync).not.toHaveBeenCalled();
      expect(mockCreateSubMutateAsync).not.toHaveBeenCalled();
      expect(mockUpdatePreferencesMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardedAt: expect.any(String),
        })
      );
    });
  });
});
