import React from 'react';
import { Text, Alert, AlertButton } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SwipeableRow, SwipeActionConfig } from '../SwipeableRow';
import { ThemeProvider } from '../../../theme';

jest.spyOn(Alert, 'alert');

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);
}

describe('SwipeableRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children content properly', () => {
    const { getByText } = renderWithTheme(
      <SwipeableRow>
        <Text>Child Item Content</Text>
      </SwipeableRow>
    );

    expect(getByText('Child Item Content')).toBeTruthy();
  });

  it('renders children without swipe container when enabled is false', () => {
    const onPress = jest.fn();
    const action: SwipeActionConfig = {
      type: 'delete',
      label: 'Delete',
      onPress,
    };

    const { getByText, queryByTestId } = renderWithTheme(
      <SwipeableRow enabled={false} action={action} testID="test-swipe-row">
        <Text>Disabled Row</Text>
      </SwipeableRow>
    );

    expect(getByText('Disabled Row')).toBeTruthy();
    expect(queryByTestId('test-swipe-row')).toBeNull();
  });

  it('exposes accessibilityActions corresponding to configured actions', () => {
    const onPress = jest.fn();
    const action: SwipeActionConfig = {
      type: 'archive',
      label: 'Archive Item',
      onPress,
    };

    const { getByTestId } = renderWithTheme(
      <SwipeableRow action={action} testID="accessible-row">
        <Text>Swipeable Row</Text>
      </SwipeableRow>
    );

    const row = getByTestId('accessible-row');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'archive', label: 'Archive Item' },
    ]);
  });

  it('executes non-destructive action without confirmation dialog when triggered via accessibility action', () => {
    const onPress = jest.fn();
    const action: SwipeActionConfig = {
      type: 'custom',
      label: 'Custom Action',
      onPress,
      isDestructive: false,
    };

    const { getByTestId } = renderWithTheme(
      <SwipeableRow action={action} testID="custom-row">
        <Text>Custom Row</Text>
      </SwipeableRow>
    );

    fireEvent(getByTestId('custom-row'), 'accessibilityAction', {
      nativeEvent: { actionName: 'custom' },
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('prompts confirmation Alert on destructive actions and invokes handler on confirm', () => {
    const onPress = jest.fn();
    const action: SwipeActionConfig = {
      type: 'delete',
      label: 'Delete Item',
      isDestructive: true,
      confirmTitle: 'Are you sure?',
      confirmMessage: 'This will be deleted.',
      confirmText: 'Delete Now',
      cancelText: 'Keep Item',
      onPress,
    };

    const { getByTestId } = renderWithTheme(
      <SwipeableRow action={action} testID="destructive-row">
        <Text>Destructive Item</Text>
      </SwipeableRow>
    );

    fireEvent(getByTestId('destructive-row'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Are you sure?',
      'This will be deleted.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Keep Item', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete Now', style: 'destructive' }),
      ])
    );
    expect(onPress).not.toHaveBeenCalled();

    // Simulate clicking the confirm button
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2] as AlertButton[];
    const confirmButton = alertButtons.find((b) => b.text === 'Delete Now');
    confirmButton?.onPress?.();

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not invoke handler when confirmation is cancelled', () => {
    const onPress = jest.fn();
    const action: SwipeActionConfig = {
      type: 'archive',
      label: 'Archive',
      confirmTitle: 'Archive this?',
      confirmMessage: 'You can restore it later.',
      cancelText: 'Cancel',
      confirmText: 'Archive',
      onPress,
    };

    const { getByTestId } = renderWithTheme(
      <SwipeableRow action={action} testID="archive-row">
        <Text>Archive Item</Text>
      </SwipeableRow>
    );

    fireEvent(getByTestId('archive-row'), 'accessibilityAction', {
      nativeEvent: { actionName: 'archive' },
    });

    expect(Alert.alert).toHaveBeenCalled();
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2] as AlertButton[];
    const cancelButton = alertButtons.find((b) => b.text === 'Cancel');
    cancelButton?.onPress?.();

    expect(onPress).not.toHaveBeenCalled();
  });
});
