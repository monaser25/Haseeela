import React from 'react';
import { Text, Pressable, I18nManager, StyleSheet } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoverTransitionProvider, COVER_IN_MS, COVER_OUT_MS } from '../TransitionCover';
import { ThemeProvider, useTheme, lightColors, darkColors } from '../../../theme';
import { I18nProvider, LayoutDirectionRoot, useI18n, LOCALE_STORAGE_KEY } from '../../../i18n';

const mockUseReducedMotion = useReducedMotion as jest.Mock;

function Probe() {
  const { locale, dir, t, toggleLocale } = useI18n();
  const { colorScheme, toggleTheme } = useTheme();
  return (
    <>
      <Text testID="locale">{locale}</Text>
      <Text testID="dir">{dir}</Text>
      <Text testID="scheme">{colorScheme}</Text>
      <Text testID="label">{t('tabs.more')}</Text>
      <Pressable testID="toggle-locale" onPress={toggleLocale} />
      <Pressable testID="toggle-theme" onPress={toggleTheme} />
    </>
  );
}

function mount() {
  return render(
    <CoverTransitionProvider>
      <ThemeProvider initialPreference="light">
        <I18nProvider initialLocale="en" coverColor="#123456">
          <LayoutDirectionRoot>
            <Probe />
          </LayoutDirectionRoot>
        </I18nProvider>
      </ThemeProvider>
    </CoverTransitionProvider>
  );
}

describe('language and theme transitions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    I18nManager.isRTL = false;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    mockUseReducedMotion.mockReturnValue(true);
    I18nManager.isRTL = false;
  });

  describe('reduce-motion on', () => {
    it('switches language and direction instantly with no cover', () => {
      mockUseReducedMotion.mockReturnValue(true);
      const { getByTestId, queryByTestId } = mount();

      fireEvent.press(getByTestId('toggle-locale'));

      expect(getByTestId('locale').props.children).toBe('ar');
      expect(getByTestId('dir').props.children).toBe('rtl');
      expect(queryByTestId('transition-cover')).toBeNull();
    });

    it('switches theme instantly with no cover', () => {
      mockUseReducedMotion.mockReturnValue(true);
      const { getByTestId, queryByTestId } = mount();

      fireEvent.press(getByTestId('toggle-theme'));

      expect(getByTestId('scheme').props.children).toBe('dark');
      expect(queryByTestId('transition-cover')).toBeNull();
    });
  });

  describe('reduce-motion off', () => {
    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(false);
    });

    it('swaps locale and layout direction together, hidden behind the cover, with no restart', () => {
      const { getByTestId, queryByTestId } = mount();
      expect(StyleSheet.flatten(getByTestId('layout-direction-root').props.style).direction).toBe('ltr');

      fireEvent.press(getByTestId('toggle-locale'));

      // Cover is up over the old content; nothing has changed underneath yet.
      expect(getByTestId('transition-cover')).toBeTruthy();
      expect(StyleSheet.flatten(getByTestId('transition-cover').props.style).backgroundColor).toBe('#123456');
      expect(getByTestId('locale').props.children).toBe('en');

      act(() => {
        jest.advanceTimersByTime(COVER_IN_MS);
      });
      // Locale, text and direction flip in the same commit.
      expect(getByTestId('locale').props.children).toBe('ar');
      expect(getByTestId('dir').props.children).toBe('rtl');
      expect(StyleSheet.flatten(getByTestId('layout-direction-root').props.style).direction).toBe('rtl');
      expect(I18nManager.isRTL).toBe(true);

      act(() => {
        jest.advanceTimersByTime(COVER_OUT_MS + 200);
      });
      expect(queryByTestId('transition-cover')).toBeNull();
    });

    it('persists the chosen locale', async () => {
      const { getByTestId } = mount();
      jest.useRealTimers();
      fireEvent.press(getByTestId('toggle-locale'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
    });

    it('rapid double toggle ends on the newest request, not an older commit', () => {
      const { getByTestId } = mount();

      fireEvent.press(getByTestId('toggle-locale')); // en -> ar
      fireEvent.press(getByTestId('toggle-locale')); // ar -> en (requested while the first is in flight)

      act(() => {
        jest.advanceTimersByTime(COVER_IN_MS + COVER_OUT_MS + 300);
      });

      expect(getByTestId('locale').props.children).toBe('en');
      expect(getByTestId('dir').props.children).toBe('ltr');
    });

    it('swaps the theme under a cover in the OLD background colour, then reveals it', () => {
      const { getByTestId, queryByTestId } = mount();

      fireEvent.press(getByTestId('toggle-theme'));

      expect(getByTestId('transition-cover')).toBeTruthy();
      expect(StyleSheet.flatten(getByTestId('transition-cover').props.style).backgroundColor).toBe(
        lightColors.bg
      );
      expect(getByTestId('scheme').props.children).toBe('light');

      act(() => {
        jest.advanceTimersByTime(COVER_IN_MS);
      });
      expect(getByTestId('scheme').props.children).toBe('dark');
      expect(darkColors.bg).not.toBe(lightColors.bg);

      act(() => {
        jest.advanceTimersByTime(COVER_OUT_MS + 200);
      });
      expect(queryByTestId('transition-cover')).toBeNull();
    });
  });
});
