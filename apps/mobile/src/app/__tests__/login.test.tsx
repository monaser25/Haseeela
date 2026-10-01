import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../(auth)/login';
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

function renderLoginScreen(locale: 'en' | 'ar' = 'en') {
  return render(
    <ThemeProvider initialPreference="light">
      <I18nProvider initialLocale={locale}>
        <LoginScreen />
      </I18nProvider>
    </ThemeProvider>
  );
}

describe('LoginScreen', () => {
  const mockSignIn = jest.fn();
  const mockResendConfirmation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    (authModule.useAuth as jest.Mock).mockReturnValue({
      status: 'signedOut',
      user: null,
      session: null,
      signIn: mockSignIn,
      resendConfirmation: mockResendConfirmation,
      signUp: jest.fn(),
      resetPassword: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it('validates required email and password fields on submit', async () => {
    const { getByTestId, getByText } = renderLoginScreen();

    const submitBtn = getByTestId('login-submit-button');
    fireEvent.press(submitBtn);

    // Validation errors should appear
    await waitFor(() => {
      expect(getByText('Email is required.')).toBeTruthy();
      expect(getByText('Password is required.')).toBeTruthy();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('validates invalid email format', async () => {
    const { getByTestId, getByText } = renderLoginScreen();

    const emailInput = getByTestId('login-email-input');
    const passwordInput = getByTestId('login-password-input');
    const submitBtn = getByTestId('login-submit-button');

    fireEvent.changeText(emailInput, 'not-an-email');
    fireEvent.changeText(passwordInput, 'validPass123');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('Please enter a valid email address.')).toBeTruthy();
    });

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('successfully calls signIn with trimmed email and password', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderLoginScreen();

    const emailInput = getByTestId('login-email-input');
    const passwordInput = getByTestId('login-password-input');
    const submitBtn = getByTestId('login-submit-button');

    fireEvent.changeText(emailInput, '  sarah@example.com  ');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('sarah@example.com', 'password123');
    });
  });

  it('handles "email not confirmed" error by offering resend confirmation button and triggering it', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Email not confirmed'));
    mockResendConfirmation.mockResolvedValueOnce(undefined);

    const { getByTestId, getByText } = renderLoginScreen();

    const emailInput = getByTestId('login-email-input');
    const passwordInput = getByTestId('login-password-input');
    const submitBtn = getByTestId('login-submit-button');

    fireEvent.changeText(emailInput, 'sarah@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(submitBtn);

    // Should display email not confirmed alert with resend button
    await waitFor(() => {
      expect(getByText('Confirm your email first')).toBeTruthy();
      expect(getByTestId('login-resend-button')).toBeTruthy();
    });

    // Press resend button
    const resendBtn = getByTestId('login-resend-button');
    fireEvent.press(resendBtn);

    await waitFor(() => {
      expect(mockResendConfirmation).toHaveBeenCalledWith('sarah@example.com');
    });
  });

  it('disables submit button and shows offline banner when offline', () => {
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);

    const { getByTestId } = renderLoginScreen();
    const submitBtn = getByTestId('login-submit-button');
    expect(submitBtn.props.accessibilityState.disabled).toBe(true);

    // Offline banner is shown
    expect(getByTestId('offline-banner')).toBeTruthy();
  });

  it('renders in Arabic proving RTL-aware copy', () => {
    const { getByText, getByTestId } = renderLoginScreen('ar');

    // Arabic title
    expect(getByText('مرحبًا بعودتك')).toBeTruthy();

    // Arabic submit button text
    expect(getByTestId('login-submit-button')).toBeTruthy();
    expect(getByText('تسجيل الدخول')).toBeTruthy();
  });
});
