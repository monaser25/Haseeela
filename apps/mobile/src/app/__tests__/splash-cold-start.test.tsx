import React from 'react';
import { I18nManager } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RootLayout, { RootContent, SPLASH_FAILSAFE_MS } from '../_layout';
import { ThemeProvider } from '../../theme';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../i18n';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import * as authModule from '../../auth';

jest.mock('../../auth', () => {
  const actual = jest.requireActual('../../auth');
  return { ...actual, useAuth: jest.fn(actual.useAuth) };
});

// SafeAreaProvider renders nothing until native insets are measured; use the library's jest mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('expo-splash-screen', () => ({
  __esModule: true,
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const mockHide = SplashScreen.hideAsync as jest.Mock;
const originalGetItem = (AsyncStorage.getItem as jest.Mock).getMockImplementation();

describe('splash screen is always released on cold start', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (I18nManager as { isRTL: boolean }).isRTL = false;
    global.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
  });

  afterEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(originalGetItem);
    jest.useRealTimers();
    setSupabaseClientForTesting(null);
    (I18nManager as { isRTL: boolean }).isRTL = false;
  });

  function mockSupabase(getSession: () => Promise<unknown>) {
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn(getSession),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    } as never);
  }

  it('stored Arabic locale + native LTR flag: the app renders and the splash is hidden', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'ar');
    (I18nManager as { isRTL: boolean }).isRTL = false;
    mockSupabase(() => Promise.resolve({ data: { session: null }, error: null }));

    const { findByTestId } = render(<RootLayout />);

    expect(await findByTestId('stack-screen-(auth)')).toBeTruthy();
    await waitFor(() => expect(mockHide).toHaveBeenCalled());
    // Arabic layout is applied in JS even though the native flag was LTR on this cold start.
    expect(I18nManager.isRTL).toBe(true);
  });

  it('a locale storage read that never resolves still gets past the splash', async () => {
    jest.useFakeTimers();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() => new Promise(() => {}));
    mockSupabase(() => Promise.resolve({ data: { session: null }, error: null }));

    const { findByTestId } = render(<RootLayout />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    expect(await findByTestId('stack-screen-(auth)')).toBeTruthy();
    expect(mockHide).toHaveBeenCalled();
  });

  describe('RootContent failsafe', () => {
    function mountRoot(status: 'loading' | 'signedOut', isLocaleReady: boolean) {
      (authModule.useAuth as jest.Mock).mockReturnValue({ status });
      return render(
        <ThemeProvider initialPreference="light">
          <I18nProvider initialLocale="en">
            <RootContent isLocaleReady={isLocaleReady} />
          </I18nProvider>
        </ThemeProvider>
      );
    }

    it('keeps the splash while booting, then hides it with a visible fallback when boot stalls', () => {
      jest.useFakeTimers();
      const { queryByTestId, getByTestId } = mountRoot('loading', true);

      expect(mockHide).not.toHaveBeenCalled();
      expect(queryByTestId('boot-fallback')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(SPLASH_FAILSAFE_MS);
      });

      expect(mockHide).toHaveBeenCalledTimes(1);
      expect(getByTestId('boot-fallback')).toBeTruthy();
    });

    it('hides the splash immediately once locale and auth are ready, without the fallback', () => {
      jest.useFakeTimers();
      const { queryByTestId, getByTestId } = mountRoot('signedOut', true);

      expect(mockHide).toHaveBeenCalledTimes(1);
      expect(getByTestId('stack-screen-(auth)')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(SPLASH_FAILSAFE_MS * 2);
      });
      expect(queryByTestId('boot-fallback')).toBeNull();
    });
  });
});
