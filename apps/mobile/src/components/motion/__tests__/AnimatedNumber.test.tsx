import React from 'react';
import { render } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { formatCurrency } from '@haseela/shared';
import { AnimatedNumber, buildCountFrames, COUNT_STEPS } from '../AnimatedNumber';

const mockUseReducedMotion = useReducedMotion as jest.Mock;

const formatUsd = (n: number) => formatCurrency(n, 'USD', 'en');
const formatEgpAr = (n: number) => formatCurrency(n, 'EGP', 'ar');

describe('buildCountFrames', () => {
  it('starts at the start value and ends exactly on the target, formatted by the caller', () => {
    const frames = buildCountFrames(0, 4800, formatUsd);

    expect(frames).toHaveLength(COUNT_STEPS + 1);
    expect(frames[0]).toBe('$0.00');
    expect(frames[COUNT_STEPS]).toBe('$4,800.00');
  });

  it('counts monotonically up and down', () => {
    const toNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ''));

    const up = buildCountFrames(0, 1000, formatUsd).map(toNumber);
    expect([...up].sort((a, b) => a - b)).toEqual(up);

    const down = buildCountFrames(1000, 200, formatUsd).map(toNumber);
    expect([...down].sort((a, b) => b - a)).toEqual(down);
  });

  it('uses the locale formatter, so Arabic frames keep the Arabic amount layout', () => {
    const frames = buildCountFrames(0, 1500, formatEgpAr);

    expect(frames[COUNT_STEPS]).toBe(formatEgpAr(1500));
    // Arabic amounts are an RTL isolate holding the LTR number followed by the symbol.
    expect(frames[COUNT_STEPS]).toBe('⁧⁦1,500.00⁩ E£⁩');
    expect(frames[0]).toBe('⁧⁦0.00⁩ E£⁩');
  });
});

describe('AnimatedNumber', () => {
  afterEach(() => {
    mockUseReducedMotion.mockReturnValue(true);
  });

  it('renders the final formatted value immediately when reduce-motion is on', () => {
    mockUseReducedMotion.mockReturnValue(true);

    const { getByTestId } = render(
      <AnimatedNumber value={4800} format={formatUsd} testID="amount" />
    );

    expect(getByTestId('amount').props.children).toBe('$4,800.00');
  });

  it('lands on the formatted target when motion is allowed', () => {
    mockUseReducedMotion.mockReturnValue(false);

    const { getByTestId } = render(
      <AnimatedNumber value={4800} format={formatUsd} testID="amount" />
    );

    expect(getByTestId('amount').props.children).toBe('$4,800.00');
  });

  it('re-targets when the value changes', () => {
    mockUseReducedMotion.mockReturnValue(false);

    const { getByTestId, rerender } = render(
      <AnimatedNumber value={100} format={formatUsd} testID="amount" />
    );
    rerender(<AnimatedNumber value={250} format={formatUsd} testID="amount" />);

    expect(getByTestId('amount').props.children).toBe('$250.00');
  });

  it('exposes the final value to screen readers and lets callers override the label', () => {
    mockUseReducedMotion.mockReturnValue(false);

    const { getByTestId, rerender } = render(
      <AnimatedNumber value={4800} format={formatUsd} testID="amount" />
    );
    expect(getByTestId('amount').props.accessibilityLabel).toBe('$4,800.00');

    rerender(
      <AnimatedNumber
        value={4800}
        format={formatUsd}
        testID="amount"
        accessibilityLabel="Net profit"
      />
    );
    expect(getByTestId('amount').props.accessibilityLabel).toBe('Net profit');
  });

  it('refreshes the text when the formatter changes (e.g. language switch)', () => {
    mockUseReducedMotion.mockReturnValue(true);

    const { getByTestId, rerender } = render(
      <AnimatedNumber value={1500} format={formatUsd} testID="amount" />
    );
    rerender(<AnimatedNumber value={1500} format={formatEgpAr} testID="amount" />);

    expect(getByTestId('amount').props.children).toBe(formatEgpAr(1500));
  });
});
