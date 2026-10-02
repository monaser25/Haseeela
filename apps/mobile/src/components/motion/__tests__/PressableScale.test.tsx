import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { PressableScale } from '../PressableScale';

const mockUseReducedMotion = useReducedMotion as jest.Mock;

describe('PressableScale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockUseReducedMotion.mockReturnValue(true);
  });

  it.each([
    ['motion allowed', false],
    ['reduce-motion on', true],
  ])('forwards press, testID and accessibility props (%s)', (_label, reduced) => {
    mockUseReducedMotion.mockReturnValue(reduced);
    const onPress = jest.fn();

    const { getByTestId } = render(
      <PressableScale
        testID="card"
        accessibilityRole="button"
        accessibilityLabel="Open card"
        onPress={onPress}
      >
        <Text>Open</Text>
      </PressableScale>
    );

    const node = getByTestId('card');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityLabel).toBe('Open card');

    fireEvent(node, 'pressIn');
    fireEvent.press(node);
    fireEvent(node, 'pressOut');

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires a light haptic on press only when asked to', () => {
    const { getByTestId, rerender } = render(
      <PressableScale testID="a" onPress={jest.fn()}>
        <Text>A</Text>
      </PressableScale>
    );

    fireEvent.press(getByTestId('a'));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    rerender(
      <PressableScale testID="a" haptic="light" onPress={jest.fn()}>
        <Text>A</Text>
      </PressableScale>
    );
    fireEvent.press(getByTestId('a'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('uses selection feedback for the selection haptic', () => {
    const { getByTestId } = render(
      <PressableScale testID="a" haptic="selection" onPress={jest.fn()}>
        <Text>A</Text>
      </PressableScale>
    );

    fireEvent.press(getByTestId('a'));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('does not press or buzz while disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PressableScale testID="a" haptic="light" disabled onPress={onPress}>
        <Text>A</Text>
      </PressableScale>
    );

    fireEvent.press(getByTestId('a'));

    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('keeps pressing when the haptic engine rejects', () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('no engine'));
    const onPress = jest.fn();

    const { getByTestId } = render(
      <PressableScale testID="a" haptic="light" onPress={onPress}>
        <Text>A</Text>
      </PressableScale>
    );

    expect(() => fireEvent.press(getByTestId('a'))).not.toThrow();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
