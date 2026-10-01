import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CheckEmailScreen from '../(auth)/check-email';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as authModule from '../../auth';
import * as onlineModule from '../../query/useIsOnline';
import { useLocalSearchParams } from 'expo-router';

jest.mock('../../auth', () => {
  const actual = jest.requireActual('../../auth');
  return {
    ...actual,
    useAuth: jest.fn(),
  };
});

jest.mock('../../query/useIsOnline', () => ({
  useIsOnline: jest.fn(),
}));

function renderCheckEmailScreen(locale: 'en' | 'ar' = 'en') {
  return render(
    <ThemeProvider initialPreference="light">
      <I18nProvider initialLocale={locale}>
        <CheckEmailScreen />
      </I18nProvider>
    </ThemeProvider>
  );
}

describe('CheckEmailScreen', () => {
  const mockResendConfirmation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      email: 'sarah@example.com',
    });
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    (authModule.useAuth as jest.Mock).mockReturnValue({
      status: 'signedOut',
      user: null,
      session: null,
      resendConfirmation: mockResendConfirmation,
      signIn: jest.fn(),
      signUp: jest.fn(),
      resetPassword: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it('renders check-email screen with target email and return to login button', () => {
    const { getByTestId, getByText } = renderCheckEmailScreen();

    expect(getByTestId('check-email-screen')).toBeTruthy();
    expect(getByText('Check your email')).toBeTruthy();
    expect(getByTestId('check-email-target-address').props.children).toBe('sarah@example.com');
    expect(getByTestId('check-email-return-login-button')).toBeTruthy();
  });

  it('renders resend button with cooldown timer and handles resend', async () => {
    mockResendConfirmation.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderCheckEmailScreen();

    const resendBtn = getByTestId('check-email-resend-button');
    expect(resendBtn).toBeTruthy();

    // Cooldown is active initially (or button is pressed when ready)
    // Verify resendConfirmation is called if not on cooldown
    authModule.setAuthEmailCooldown('sarah@example.com', 0);
    fireEvent.press(resendBtn);

    await waitFor(() => {
      expect(mockResendConfirmation).toHaveBeenCalledWith('sarah@example.com');
    });
  });
});
