import React from 'react';
import { render } from '@testing-library/react-native';
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
    const { getByTestId, getByText } = renderTabLayout('en');

    expect(getByTestId('tab-screen-index')).toBeTruthy();
    expect(getByText('Home')).toBeTruthy();

    expect(getByTestId('tab-screen-transactions')).toBeTruthy();
    expect(getByText('Transactions')).toBeTruthy();

    expect(getByTestId('tab-screen-clients')).toBeTruthy();
    expect(getByText('Clients')).toBeTruthy();

    expect(getByTestId('tab-screen-more')).toBeTruthy();
    expect(getByText('More')).toBeTruthy();
  });

  it('renders all four tabs with correct Arabic labels', () => {
    const { getByTestId, getByText } = renderTabLayout('ar');

    expect(getByTestId('tab-screen-index')).toBeTruthy();
    expect(getByText('الرئيسية')).toBeTruthy();

    expect(getByTestId('tab-screen-transactions')).toBeTruthy();
    expect(getByText('المعاملات')).toBeTruthy();

    expect(getByTestId('tab-screen-clients')).toBeTruthy();
    expect(getByText('العملاء')).toBeTruthy();

    expect(getByTestId('tab-screen-more')).toBeTruthy();
    expect(getByText('المزيد')).toBeTruthy();
  });
});
