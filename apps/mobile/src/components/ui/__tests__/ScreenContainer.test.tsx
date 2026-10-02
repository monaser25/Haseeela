import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenContainer } from '../ScreenContainer';
import { ThemeProvider } from '../../../theme';
import { I18nProvider } from '../../../i18n';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderContainer(props: Partial<React.ComponentProps<typeof ScreenContainer>>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialPreference="light">
        <I18nProvider initialLocale="en">
          <ScreenContainer testID="screen" {...props}>
            <View testID="child" />
          </ScreenContainer>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Style of the closest ancestor View that carries a style (the content wrapper). */
function wrapperStyle(node: ReactTestInstance) {
  let current = node.parent;
  while (current) {
    if (current.props.style) {
      return StyleSheet.flatten(current.props.style as StyleProp<ViewStyle>);
    }
    current = current.parent;
  }
  return undefined;
}

describe('ScreenContainer', () => {
  it('wraps children in a ScrollView by default', () => {
    const { UNSAFE_getAllByType } = renderContainer({});
    expect(UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
  });

  it('does not add a ScrollView when scrollable is false, so a list can be the scroll container', () => {
    const { UNSAFE_queryAllByType } = renderContainer({ scrollable: false });
    expect(UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  });

  it('lets non-scrolling content fill the screen height instead of collapsing', () => {
    const { getByTestId } = renderContainer({ scrollable: false });
    expect(wrapperStyle(getByTestId('child'))?.flex).toBe(1);
  });

  it('removes the built-in padding when padded is false', () => {
    const { getByTestId } = renderContainer({ scrollable: false, padded: false });
    const style = wrapperStyle(getByTestId('child'));
    expect(style?.paddingHorizontal).toBe(0);
    expect(style?.paddingVertical).toBe(0);
  });
});
