import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '../(auth)/forgot-password';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as authModule from '../../auth';
import * as onlineModule from '../../query/useIsOnline';

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

function renderForgotPasswordScreen(locale: 'en' | 'ar' = 'en') {
  return render(
    <ThemeProvider initialPreference="light">
      <I18nProvider initialLocale={locale}>
        <ForgotPasswordScreen />
      </I18nProvider>
    </ThemeProvider>
  );
}

describe('ForgotPasswordScreen', () => {
  const mockResetPassword = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    (authModule.useAuth as jest.Mock).mockReturnValue({
      status: 'signedOut',
      user: null,
      session: null,
      resetPassword: mockResetPassword,
      signIn: jest.fn(),
      signUp: jest.fn(),
      resendConfirmation: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it('validates email field on submit', async () => {
    const { getByTestId, getByText } = renderForgotPasswordScreen();

    const submitBtn = getByTestId('forgot-password-submit-button');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('Email is required.')).toBeTruthy();
    });

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword and displays success state with resend button', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined);
    const { getByTestId, getByText } = renderForgotPasswordScreen();

    const emailInput = getByTestId('forgot-password-email-input');
    const submitBtn = getByTestId('forgot-password-submit-button');

    fireEvent.changeText(emailInput, 'sarah@example.com');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('sarah@example.com');
      // Success screen elements
      expect(getByTestId('forgot-password-success-screen')).toBeTruthy();
      expect(getByText('Check your email')).toBeTruthy();
      expect(getByTestId('forgot-password-resend-button')).toBeTruthy();
    });
  });
});
