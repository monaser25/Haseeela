import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { FloatingTabBar, FloatingTabBarProps } from '../FloatingTabBar';
import { ThemeProvider } from '../../../theme';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const routes = [
  { key: 'index-1', name: 'index' },
  { key: 'transactions-1', name: 'transactions' },
  { key: 'clients-1', name: 'clients' },
  { key: 'more-1', name: 'more' },
];

const labels: Record<string, string> = {
  'index-1': 'Home',
  'transactions-1': 'Transactions',
  'clients-1': 'Clients',
  'more-1': 'More',
};

function renderBar(index = 0, defaultPrevented = false) {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented }));

  const props: FloatingTabBarProps = {
    state: { index, routes },
    descriptors: Object.fromEntries(
      routes.map((route) => [
        route.key,
        { options: { title: labels[route.key], tabBarAccessibilityLabel: labels[route.key] } },
      ])
    ),
    navigation: { emit, navigate },
  };

  const utils = render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialPreference="light">
        <FloatingTabBar {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );

  return { ...utils, navigate, emit };
}

describe('FloatingTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one labelled tab per route and marks only the focused one as selected', () => {
    const { getByTestId, getByText } = renderBar(1);

    for (const label of Object.values(labels)) {
      expect(getByText(label)).toBeTruthy();
    }

    expect(getByTestId('tab-button-transactions').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('tab-button-index').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('tab-button-more').props.accessibilityRole).toBe('tab');
  });

  it('navigates to another tab on press, emits tabPress and gives selection haptics', () => {
    const { getByTestId, navigate, emit } = renderBar(0);

    fireEvent.press(getByTestId('tab-button-clients'));

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'clients-1',
      canPreventDefault: true,
    });
    expect(navigate).toHaveBeenCalledWith('clients', undefined);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when the tab is already focused or the press was prevented', () => {
    const focused = renderBar(0);
    fireEvent.press(focused.getByTestId('tab-button-index'));
    expect(focused.navigate).not.toHaveBeenCalled();

    const prevented = renderBar(0, true);
    fireEvent.press(prevented.getByTestId('tab-button-more'));
    expect(prevented.navigate).not.toHaveBeenCalled();
  });
});
