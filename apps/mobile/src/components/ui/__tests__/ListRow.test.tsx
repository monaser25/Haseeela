import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Bell } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ListGroup, ListRow } from '../ListRow';
import { ThemeProvider } from '../../../theme';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider initialPreference="light">{ui}</ThemeProvider>);
}

describe('ListRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is a button that presses through, labelled by its title by default', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = renderWithTheme(
      <ListRow testID="row" icon={Bell} title="Notifications" subtitle="Reminders" onPress={onPress} />
    );

    expect(getByText('Reminders')).toBeTruthy();
    expect(getByTestId('row').props.accessibilityRole).toBe('button');
    expect(getByTestId('row').props.accessibilityLabel).toBe('Notifications');

    fireEvent.press(getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('becomes a switch row with checked state when switchValue is provided', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = renderWithTheme(
      <ListRow testID="row" title="Dark mode" switchValue={false} onPress={onPress} />
    );

    expect(getByTestId('row').props.accessibilityRole).toBe('switch');
    expect(getByTestId('row').props.accessibilityState.checked).toBe(false);

    fireEvent.press(getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(
      <ThemeProvider initialPreference="light">
        <ListRow testID="row" title="Dark mode" switchValue onPress={onPress} />
      </ThemeProvider>
    );
    expect(getByTestId('row').props.accessibilityState.checked).toBe(true);
  });

  it('ignores presses while disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(
      <ListRow testID="row" title="Log out" danger disabled onPress={onPress} />
    );

    fireEvent.press(getByTestId('row'));

    expect(onPress).not.toHaveBeenCalled();
    expect(getByTestId('row').props.accessibilityState.disabled).toBe(true);
  });

  it('renders without press handling when there is no onPress', () => {
    const { getByTestId } = renderWithTheme(<ListRow testID="row" title="Version" />);

    expect(getByTestId('row').props.accessibilityRole).toBeUndefined();
  });
});

describe('ListGroup', () => {
  it('renders every row', () => {
    const { getByText } = renderWithTheme(
      <ListGroup>
        <ListRow title="One" />
        <ListRow title="Two" />
        <ListRow title="Three" />
      </ListGroup>
    );

    expect(getByText('One')).toBeTruthy();
    expect(getByText('Two')).toBeTruthy();
    expect(getByText('Three')).toBeTruthy();
  });
});
