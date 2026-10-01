import React from 'react';
import { render } from '@testing-library/react-native';
import {
  PasswordStrength,
  calculatePasswordStrength,
} from '../PasswordStrength';
import { ThemeProvider } from '../../../theme';
import { I18nProvider } from '../../../i18n';

describe('PasswordStrength', () => {
  it('correctly calculates score based on length, cases, digits, symbols', () => {
    expect(calculatePasswordStrength('')).toBe(0);
    expect(calculatePasswordStrength('abc')).toBe(0);
    expect(calculatePasswordStrength('abcdefgh')).toBe(1); // >= 8 chars
    expect(calculatePasswordStrength('Abcdefgh')).toBe(2); // >= 8 chars + upper/lower
    expect(calculatePasswordStrength('Abcdefg1')).toBe(3); // + digit
    expect(calculatePasswordStrength('Abcdef1!')).toBe(4); // + special char
  });

  it('renders translated strength labels in English and Arabic', () => {
    const { getByTestId: getByTestIdEn } = render(
      <ThemeProvider>
        <I18nProvider initialLocale="en">
          <PasswordStrength password="weak" testID="meter-en-short" />
        </I18nProvider>
      </ThemeProvider>
    );

    expect(getByTestIdEn('meter-en-short-label').props.children).toBe('Too short');

    const { getByTestId: getByTestIdStrong } = render(
      <ThemeProvider>
        <I18nProvider initialLocale="en">
          <PasswordStrength password="StrongP@ssw0rd!" testID="meter-en-strong" />
        </I18nProvider>
      </ThemeProvider>
    );

    expect(getByTestIdStrong('meter-en-strong-label').props.children).toBe('Strong');

    const { getByTestId: getByTestIdAr } = render(
      <ThemeProvider>
        <I18nProvider initialLocale="ar">
          <PasswordStrength password="StrongP@ssw0rd!" testID="meter-ar" />
        </I18nProvider>
      </ThemeProvider>
    );

    // In Arabic, "Strong" is "قوي"
    expect(getByTestIdAr('meter-ar-label').props.children).toBe('قوي');
  });
});
