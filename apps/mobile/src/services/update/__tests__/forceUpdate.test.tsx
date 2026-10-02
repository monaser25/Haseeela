import React from 'react';
import { AppState, Linking, Platform, Text } from 'react-native';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { ThemeProvider } from '../../../theme';
import { darkColors } from '../../../theme/colors';
import { I18nProvider } from '../../../i18n';
import { MockHttpServer } from '../../../test/mockServer';
import { ForceUpdateGate, FOREGROUND_CHECK_INTERVAL_MS } from '../ForceUpdateGate';
import { ANDROID_STORE_URL } from '../minVersion';

const setExpoConfig = (value: unknown) => {
  (Constants as unknown as { expoConfig: unknown }).expoConfig = value;
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0', extra: {} } },
}));

describe('ForceUpdateGate', () => {
  let server: MockHttpServer;

  const mountGate = (locale: 'en' | 'ar' = 'en', themePreference: 'light' | 'dark' = 'light') =>
    render(
      <ThemeProvider initialPreference={themePreference}>
        <I18nProvider initialLocale={locale}>
          <ForceUpdateGate>
            <Text testID="app-content">App</Text>
          </ForceUpdateGate>
        </I18nProvider>
      </ThemeProvider>
    );

  const healthCalls = () => server.getRequests().filter((r) => r.path === '/api/health');

  beforeEach(() => {
    jest.clearAllMocks();
    setExpoConfig({ version: '1.0.0', extra: {} });
    server = new MockHttpServer();
    server.reset();
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
      server.fetchHandler(url, init)
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks the app with the update screen when the app version is below the minimum', async () => {
    server.minMobileVersion = '1.2.0';
    const view = mountGate();

    await waitFor(() => expect(view.getByTestId('update-required-screen')).toBeTruthy());
    expect(view.queryByTestId('app-content')).toBeNull();
    expect(view.getByText('Update required')).toBeTruthy();
  });

  it.each([
    ['equal to', '1.0.0'],
    ['above', '0.9.0'],
  ])('renders the app normally when the version is %s the minimum', async (_label, min) => {
    server.minMobileVersion = min;
    const view = mountGate();

    await waitFor(() => expect(healthCalls()).toHaveLength(1));
    await act(async () => {});
    expect(view.getByTestId('app-content')).toBeTruthy();
    expect(view.queryByTestId('update-required-screen')).toBeNull();
  });

  it('fails open when the health endpoint returns an error', async () => {
    server.setError('/api/health', 500, { error: 'down' });
    const view = mountGate();

    await waitFor(() => expect(healthCalls()).toHaveLength(1));
    await act(async () => {});
    expect(view.getByTestId('app-content')).toBeTruthy();
    expect(view.queryByTestId('update-required-screen')).toBeNull();
  });

  it('fails open when the network request throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const view = mountGate();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await act(async () => {});
    expect(view.getByTestId('app-content')).toBeTruthy();
  });

  it.each([['garbage'], ['']])('fails open on a malformed minMobileVersion (%j)', async (bad) => {
    server.minMobileVersion = bad;
    const view = mountGate();

    await waitFor(() => expect(healthCalls()).toHaveLength(1));
    await act(async () => {});
    expect(view.getByTestId('app-content')).toBeTruthy();
  });

  it('fails open when the app version is unknown', async () => {
    setExpoConfig({ extra: {} });
    server.minMobileVersion = '9.0.0';
    const view = mountGate();

    await act(async () => {});
    expect(view.getByTestId('app-content')).toBeTruthy();
  });

  it('opens the Play Store listing for com.haseela.app on android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    server.minMobileVersion = '2.0.0';
    const view = mountGate();

    await waitFor(() => expect(view.getByTestId('update-required-button')).toBeTruthy());
    fireEvent.press(view.getByTestId('update-required-button'));

    expect(openURL).toHaveBeenCalledWith(ANDROID_STORE_URL);
    expect(ANDROID_STORE_URL).toContain('id=com.haseela.app');
  });

  it('shows a message when the store cannot be opened', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    server.minMobileVersion = '2.0.0';
    const view = mountGate();

    await waitFor(() => expect(view.getByTestId('update-required-button')).toBeTruthy());
    fireEvent.press(view.getByTestId('update-required-button'));

    await waitFor(() => expect(view.getByTestId('update-required-open-failed')).toBeTruthy());
  });

  describe('iOS store link', () => {
    const originalUrl = process.env.EXPO_PUBLIC_IOS_STORE_URL;
    afterEach(() => {
      if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_IOS_STORE_URL;
      else process.env.EXPO_PUBLIC_IOS_STORE_URL = originalUrl;
    });

    it('has no store button when no App Store URL is configured', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      delete process.env.EXPO_PUBLIC_IOS_STORE_URL;
      server.minMobileVersion = '2.0.0';
      const view = mountGate();

      await waitFor(() => expect(view.getByTestId('update-required-screen')).toBeTruthy());
      expect(view.queryByTestId('update-required-button')).toBeNull();
    });

    it('opens the configured App Store URL', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      process.env.EXPO_PUBLIC_IOS_STORE_URL = 'https://apps.apple.com/app/id0000000000';
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      server.minMobileVersion = '2.0.0';
      const view = mountGate();

      await waitFor(() => expect(view.getByTestId('update-required-button')).toBeTruthy());
      fireEvent.press(view.getByTestId('update-required-button'));

      expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id0000000000');
    });
  });

  it('renders Arabic copy with right-to-left text direction', async () => {
    server.minMobileVersion = '2.0.0';
    const view = mountGate('ar');

    await waitFor(() => expect(view.getByText('التحديث مطلوب')).toBeTruthy());
    expect(view.getByText('التحديث مطلوب')).toHaveStyle({ writingDirection: 'rtl', textAlign: 'center' });
  });

  it('uses dark theme colours in dark mode', async () => {
    server.minMobileVersion = '2.0.0';
    const view = mountGate('en', 'dark');

    await waitFor(() => expect(view.getByTestId('update-required-screen')).toBeTruthy());
    expect(view.getByTestId('update-required-screen')).toHaveStyle({ backgroundColor: darkColors.bg });
    expect(view.getByText('Update required')).toHaveStyle({ color: darkColors.text });
  });

  describe('foreground re-check', () => {
    let appStateListener: ((state: string) => void) | null;

    beforeEach(() => {
      appStateListener = null;
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (state: string) => void) => {
        appStateListener = cb;
        return { remove: jest.fn() };
      }) as unknown as typeof AppState.addEventListener);
    });

    it('is throttled, then blocks once the minimum version is raised', async () => {
      const now = jest.spyOn(Date, 'now');
      now.mockReturnValue(1_000_000);
      const view = mountGate();
      await waitFor(() => expect(healthCalls()).toHaveLength(1));

      // Returning to the foreground immediately does not re-check
      server.minMobileVersion = '2.0.0';
      act(() => appStateListener?.('active'));
      await act(async () => {});
      expect(healthCalls()).toHaveLength(1);
      expect(view.getByTestId('app-content')).toBeTruthy();

      // After the throttle window it does, and blocks
      now.mockReturnValue(1_000_000 + FOREGROUND_CHECK_INTERVAL_MS);
      act(() => appStateListener?.('active'));
      await waitFor(() => expect(view.getByTestId('update-required-screen')).toBeTruthy());
      expect(healthCalls()).toHaveLength(2);
    });

    it('stays blocked when a later check fails', async () => {
      const now = jest.spyOn(Date, 'now');
      now.mockReturnValue(1_000_000);
      server.minMobileVersion = '2.0.0';
      const view = mountGate();
      await waitFor(() => expect(view.getByTestId('update-required-screen')).toBeTruthy());

      server.setError('/api/health', 500, { error: 'down' });
      now.mockReturnValue(1_000_000 + FOREGROUND_CHECK_INTERVAL_MS);
      act(() => appStateListener?.('active'));
      await waitFor(() => expect(healthCalls()).toHaveLength(2));
      await act(async () => {});

      expect(view.getByTestId('update-required-screen')).toBeTruthy();
    });
  });
});
