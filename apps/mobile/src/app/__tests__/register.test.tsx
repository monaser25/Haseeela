import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../(auth)/register';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as authModule from '../../auth';
import * as onlineModule from '../../query/useIsOnline';
import { useRouter } from 'expo-router';

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

function renderRegisterScreen(locale: 'en' | 'ar' = 'en') {
  return render(
    <ThemeProvider initialPreference="light">
      <I18nProvider initialLocale={locale}>
        <RegisterScreen />
      </I18nProvider>
    </ThemeProvider>
  );
}

describe('RegisterScreen', () => {
  const mockSignUp = jest.fn();
  const mockRouterPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => true,
    });
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    (authModule.useAuth as jest.Mock).mockReturnValue({
      status: 'signedOut',
      user: null,
      session: null,
      signUp: mockSignUp,
      signIn: jest.fn(),
      resendConfirmation: jest.fn(),
      resetPassword: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it('validates name, email, and password length (minimum 8 characters)', async () => {
    const { getByTestId, getByText } = renderRegisterScreen();

    const nameInput = getByTestId('register-name-input');
    const emailInput = getByTestId('register-email-input');
    const passwordInput = getByTestId('register-password-input');
    const submitBtn = getByTestId('register-submit-button');

    // Test with empty fields
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('Name is required.')).toBeTruthy();
      expect(getByText('Email is required.')).toBeTruthy();
      expect(getByText('Password is required.')).toBeTruthy();
    });

    // Test password too short (< 8 characters)
    fireEvent.changeText(nameInput, 'Sarah Chen');
    fireEvent.changeText(emailInput, 'sarah@example.com');
    fireEvent.changeText(passwordInput, 'short');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
    });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('successfully calls signUp with trimmed name, email, and password and navigates to check-email', async () => {
    mockSignUp.mockResolvedValueOnce({ requiresEmailConfirmation: true });

    const { getByTestId } = renderRegisterScreen();

    const nameInput = getByTestId('register-name-input');
    const emailInput = getByTestId('register-email-input');
    const passwordInput = getByTestId('register-password-input');
    const submitBtn = getByTestId('register-submit-button');

    fireEvent.changeText(nameInput, '  Sarah Chen  ');
    fireEvent.changeText(emailInput, '  sarah@example.com  ');
    fireEvent.changeText(passwordInput, 'SecurePass123!');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'sarah@example.com',
        'SecurePass123!',
        'Sarah Chen'
      );
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(auth)/check-email',
        params: { email: 'sarah@example.com' },
      });
    });
  });

  it('displays password strength meter when password is typed', () => {
    const { getByTestId, queryByTestId } = renderRegisterScreen();

    // Not present when password is empty
    expect(queryByTestId('register-password-strength')).toBeNull();

    const passwordInput = getByTestId('register-password-input');
    fireEvent.changeText(passwordInput, 'Secret123!');

    expect(getByTestId('register-password-strength')).toBeTruthy();
  });
});
