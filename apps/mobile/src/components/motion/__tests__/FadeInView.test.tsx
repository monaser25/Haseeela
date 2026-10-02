import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { FadeInView, staggerDelay } from '../FadeInView';
import { motion } from '../../../theme';

const mockUseReducedMotion = useReducedMotion as jest.Mock;

describe('staggerDelay', () => {
  it('steps by the stagger interval', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(motion.stagger.step);
    expect(staggerDelay(3)).toBe(3 * motion.stagger.step);
  });

  it('caps long groups so late items never wait', () => {
    const cap = motion.stagger.maxItems * motion.stagger.step;
    expect(staggerDelay(motion.stagger.maxItems)).toBe(cap);
    expect(staggerDelay(50)).toBe(cap);
  });

  it('treats negative indexes as the first item', () => {
    expect(staggerDelay(-2)).toBe(0);
  });
});

describe('FadeInView', () => {
  afterEach(() => {
    mockUseReducedMotion.mockReturnValue(true);
  });

  it('renders children immediately with no entering animation when reduce-motion is on', () => {
    mockUseReducedMotion.mockReturnValue(true);

    const { getByTestId, getByText } = render(
      <FadeInView testID="block" index={2}>
        <Text>Content</Text>
      </FadeInView>
    );

    expect(getByText('Content')).toBeTruthy();
    expect(getByTestId('block').props.entering).toBeUndefined();
  });

  it('attaches an entering animation when motion is allowed', () => {
    mockUseReducedMotion.mockReturnValue(false);

    const { getByTestId, getByText } = render(
      <FadeInView testID="block" index={2}>
        <Text>Content</Text>
      </FadeInView>
    );

    expect(getByText('Content')).toBeTruthy();
    expect(getByTestId('block').props.entering).toBeDefined();
  });

  it('passes view props such as accessibility roles through', () => {
    const { getByTestId } = render(
      <FadeInView testID="block" accessibilityRole="alert">
        <Text>Heads up</Text>
      </FadeInView>
    );

    expect(getByTestId('block').props.accessibilityRole).toBe('alert');
  });
});
