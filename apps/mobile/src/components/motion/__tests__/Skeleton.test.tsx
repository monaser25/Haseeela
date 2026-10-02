import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Skeleton } from '../Skeleton';
import { ThemeProvider } from '../../../theme';
import { I18nProvider } from '../../../i18n';

const mockUseReducedMotion = useReducedMotion as jest.Mock;

function renderSkeleton() {
  const utils = render(
    <ThemeProvider initialPreference="light">
      <I18nProvider initialLocale="en">
        <Skeleton testID="skeleton" height={20} />
      </I18nProvider>
    </ThemeProvider>
  );
  // The skeleton is deliberately hidden from assistive tech, so queries must opt in to see it.
  const getSkeleton = () => utils.getByTestId('skeleton', { includeHiddenElements: true });
  return { ...utils, getSkeleton };
}

function layout(width: number) {
  return { nativeEvent: { layout: { width, height: 20, x: 0, y: 0 } } };
}

describe('Skeleton', () => {
  afterEach(() => {
    mockUseReducedMotion.mockReturnValue(true);
  });

  it('is hidden from assistive technology', () => {
    const { getSkeleton } = renderSkeleton();

    expect(getSkeleton().props.accessibilityElementsHidden).toBe(true);
    expect(getSkeleton().props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('renders a static block with no shimmer when reduce-motion is on', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { getSkeleton, queryByTestId } = renderSkeleton();

    fireEvent(getSkeleton(), 'layout', layout(200));

    expect(queryByTestId('linear-gradient', { includeHiddenElements: true })).toBeNull();
  });

  it('adds the shimmer sweep once measured when motion is allowed', () => {
    mockUseReducedMotion.mockReturnValue(false);
    const { getSkeleton, queryByTestId } = renderSkeleton();

    expect(queryByTestId('linear-gradient', { includeHiddenElements: true })).toBeNull();
    fireEvent(getSkeleton(), 'layout', layout(200));

    expect(queryByTestId('linear-gradient', { includeHiddenElements: true })).toBeTruthy();
  });
});
