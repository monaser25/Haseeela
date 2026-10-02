import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabLayout from '../(app)/(tabs)/_layout';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';

function renderTabLayout(initialLocale: 'en' | 'ar' = 'en') {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialPreference="light">
        <I18nProvider initialLocale={initialLocale}>
          <TabLayout />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('TabLayout bottom-tab navigation', () => {
  it('renders all four tabs with correct English labels', () => {
    const { getByTestId } = renderTabLayout('en');

    expect(getByTestId('tab-screen-index').props.accessibilityLabel).toBe('Home');

    expect(getByTestId('tab-screen-transactions').props.accessibilityLabel).toBe('Transactions');

    expect(getByTestId('tab-screen-clients').props.accessibilityLabel).toBe('Clients');

    expect(getByTestId('tab-screen-more').props.accessibilityLabel).toBe('More');
  });

  it('renders all four tabs with correct Arabic labels', () => {
    const { getByTestId } = renderTabLayout('ar');

    expect(getByTestId('tab-screen-index').props.accessibilityLabel).toBe('الرئيسية');

    expect(getByTestId('tab-screen-transactions').props.accessibilityLabel).toBe('المعاملات');

    expect(getByTestId('tab-screen-clients').props.accessibilityLabel).toBe('العملاء');

    expect(getByTestId('tab-screen-more').props.accessibilityLabel).toBe('المزيد');
  });

  it('renders all four tab buttons in the floating bar and navigates on press', () => {
    const { getByTestId } = renderTabLayout('en');

    expect(getByTestId('tab-button-index')).toBeTruthy();
    expect(getByTestId('tab-button-transactions')).toBeTruthy();
    expect(getByTestId('tab-button-clients')).toBeTruthy();
    expect(getByTestId('tab-button-more')).toBeTruthy();

    fireEvent.press(getByTestId('tab-button-transactions'));
    const router = require('expo-router').useRouter();
    expect(router.navigate).toHaveBeenCalledWith('transactions', undefined);
  });
});

