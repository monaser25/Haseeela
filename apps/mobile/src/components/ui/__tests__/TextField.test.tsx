import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextField } from '../TextField';
import { ThemeProvider } from '../../../theme';
import { I18nProvider } from '../../../i18n';

function renderTextField(props: any, locale: 'en' | 'ar' = 'en') {
  return render(
    <ThemeProvider initialPreference="light">
      <I18nProvider initialLocale={locale}>
        <TextField {...props} />
      </I18nProvider>
    </ThemeProvider>
  );
}

describe('TextField', () => {
  it('renders visible label, hint text, and handles input', () => {
    const onChangeText = jest.fn();
    const { getByText, getByPlaceholderText } = renderTextField({
      label: 'Email Address',
      hint: 'We will never share your email',
      placeholder: 'you@example.com',
      onChangeText,
      testID: 'email-field',
    });

    expect(getByText('Email Address')).toBeTruthy();
    expect(getByText('We will never share your email')).toBeTruthy();

    const input = getByPlaceholderText('you@example.com');
    fireEvent.changeText(input, 'test@example.com');
    expect(onChangeText).toHaveBeenCalledWith('test@example.com');
  });

  it('renders error text with accessibilityRole="alert" and accessibilityLiveRegion="polite"', () => {
    const { getByTestId, getByText } = renderTextField({
      label: 'Email',
      error: 'Email is required.',
      testID: 'email-field',
    });

    const errorEl = getByTestId('email-field-error');
    expect(errorEl).toBeTruthy();
    expect(getByText('Email is required.')).toBeTruthy();
    expect(errorEl.props.accessibilityRole).toBe('alert');
    expect(errorEl.props.accessibilityLiveRegion).toBe('polite');
  });

  it('toggles password visibility and updates accessibilityLabel between show and hide', () => {
    const { getByTestId } = renderTextField({
      label: 'Password',
      isPassword: true,
      testID: 'password-field',
    });

    const toggleButton = getByTestId('password-field-toggle-password');
    expect(toggleButton).toBeTruthy();
    expect(toggleButton.props.accessibilityRole).toBe('button');

    // Initially hidden: label is "Show password"
    expect(toggleButton.props.accessibilityLabel).toBe('Show password');

    // Tap to show password
    fireEvent.press(toggleButton);

    // Now showing: label is "Hide password"
    expect(toggleButton.props.accessibilityLabel).toBe('Hide password');

    // Tap again to hide
    fireEvent.press(toggleButton);
    expect(toggleButton.props.accessibilityLabel).toBe('Show password');
  });

  it('renders in Arabic with RTL-aware copy for show/hide password and labels', () => {
    const { getByTestId } = renderTextField(
      {
        label: 'كلمة المرور',
        isPassword: true,
        testID: 'arabic-password-field',
      },
      'ar'
    );

    const toggleButton = getByTestId('arabic-password-field-toggle-password');
    expect(toggleButton).toBeTruthy();

    // Arabic translation for "Show password" is "إظهار كلمة المرور"
    expect(toggleButton.props.accessibilityLabel).toBe('إظهار كلمة المرور');

    // Toggle
    fireEvent.press(toggleButton);

    // Arabic translation for "Hide password" is "إخفاء كلمة المرور"
    expect(toggleButton.props.accessibilityLabel).toBe('إخفاء كلمة المرور');
  });
});
