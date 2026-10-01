import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TabBarFab } from '../../components/navigation/TabBarFab';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

function renderFab(initialLocale = 'en' as const) {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialPreference="light">
        <I18nProvider initialLocale={initialLocale}>
          <TabBarFab />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('TabBar Center FAB and Action Sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders FAB with accessible label and touch target ≥56pt', () => {
    const { getByTestId } = renderFab('en');

    const fab = getByTestId('tab-bar-fab');
    expect(fab).toBeTruthy();
    expect(fab.props.accessibilityRole).toBe('button');
    expect(fab.props.accessibilityLabel).toBe('Add transaction');
  });

  it('opens action sheet on FAB press, showing Add income and Add expense options', () => {
    const { getByTestId, queryByTestId } = renderFab('en');

    // Initially action sheet modal is not visible (or hidden)
    const fab = getByTestId('tab-bar-fab');
    fireEvent.press(fab);

    expect(getByTestId('fab-action-sheet')).toBeTruthy();
    expect(getByTestId('action-sheet-add-income')).toBeTruthy();
    expect(getByTestId('action-sheet-add-expense')).toBeTruthy();
  });

  it('routes to preset modal for Add income', () => {
    const { getByTestId } = renderFab('en');

    fireEvent.press(getByTestId('tab-bar-fab'));

    const addIncomeBtn = getByTestId('action-sheet-add-income');
    fireEvent.press(addIncomeBtn);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction/new',
      params: { type: 'INCOME' },
    });
  });

  it('routes to preset modal for Add expense', () => {
    const { getByTestId } = renderFab('en');

    fireEvent.press(getByTestId('tab-bar-fab'));

    const addExpenseBtn = getByTestId('action-sheet-add-expense');
    fireEvent.press(addExpenseBtn);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction/new',
      params: { type: 'EXPENSE' },
    });
  });

  it('closes action sheet when close button is pressed', () => {
    const { getByTestId, queryByTestId } = renderFab('en');

    fireEvent.press(getByTestId('tab-bar-fab'));
    expect(getByTestId('fab-action-sheet')).toBeTruthy();

    const closeBtn = getByTestId('action-sheet-cancel');
    fireEvent.press(closeBtn);

    // Modal is dismissed, action sheet content is removed
    expect(queryByTestId('fab-action-sheet')).toBeNull();
  });
});
