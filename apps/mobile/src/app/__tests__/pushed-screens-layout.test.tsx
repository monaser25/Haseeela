import fs from 'fs';
import path from 'path';
import React from 'react';
import { ScrollView } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import SettingsScreen from '../(app)/settings';
import ProfileScreen from '../(app)/profile';
import NotificationsScreen from '../(app)/notifications';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { createTestQueryClient } from '../../test/testQueryClient';
import { MockHttpServer, defaultMockPreferences, defaultMockNotifications } from '../../test/mockServer';

const appDir = path.resolve(__dirname, '../(app)');

function listScreenFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === '(tabs)' ? [] : listScreenFiles(full);
    }
    return /\.tsx$/.test(entry.name) && entry.name !== '_layout.tsx' ? [full] : [];
  });
}

/**
 * "Tapping Profile / Notifications opens a screen inside a screen" and the broken Settings page had
 * one cause: those screens lay themselves out (own header, own padded ScrollView) but were wrapped
 * in ScreenContainer's DEFAULT scroller, which adds a second ScrollView plus a second layer of
 * padding, so the page rendered as a padded, centered, nested scroller. A screen that owns a
 * ScrollView must tell ScreenContainer not to scroll or pad.
 */
describe('pushed screens do not nest a second scroll container', () => {
  const files = listScreenFiles(appDir).filter((file) => fs.readFileSync(file, 'utf-8').includes('<ScrollView'));

  it('finds the pushed screens that own a ScrollView', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files.map((file) => [path.relative(appDir, file), file]))(
    '%s: the ScreenContainer around its ScrollView is scrollable={false} padded={false}',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf-8');
      let index = source.indexOf('<ScrollView');
      while (index !== -1) {
        const containerStart = source.lastIndexOf('<ScreenContainer', index);
        expect(containerStart).toBeGreaterThanOrEqual(0);
        const openingTag = /<ScreenContainer[\s\S]*?(?<!=)>/.exec(source.slice(containerStart))?.[0] ?? '';
        expect(openingTag).toContain('scrollable={false}');
        expect(openingTag).toContain('padded={false}');
        index = source.indexOf('<ScrollView', index + 1);
      }
    }
  );
});

describe('pushed screens show exactly one header', () => {
  it('the (app) stack hides its native header and no screen turns it back on', () => {
    const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
    expect(layout).toMatch(/screenOptions=\{\{[\s\S]*?headerShown: false/);
    expect(layout).not.toMatch(/headerShown: true/);
  });

  it('pushed screens animate along the reading direction with swipe-back enabled', () => {
    const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf-8');
    expect(layout).toContain("animation: 'slide_from_right'");
    expect(layout).toContain('gestureEnabled: true');
    expect(layout).toContain('fullScreenGestureEnabled: true');
  });
});

describe('Settings, Profile and Notifications render a single scroll container', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    const server = new MockHttpServer();
    server.reset({
      preferences: { ...defaultMockPreferences, name: 'Sarah Chen', email: 'sarah@chenstudio.co' },
      notifications: [...defaultMockNotifications],
    });
    global.fetch = jest.fn((url: unknown, init?: unknown) =>
      server.fetchHandler(url as never, init as never)
    ) as unknown as typeof fetch;
    queryClient = createTestQueryClient();
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'user-layout', email: 'sarah@chenstudio.co', user_metadata: { name: 'Sarah Chen' } },
              access_token: 'token',
            },
          },
          error: null,
        }),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    } as never);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
    queryClient.clear();
  });

  function renderScreen(screen: React.ReactElement) {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider initialPreference="light">
              <I18nProvider initialLocale="en">{screen}</I18nProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  it('Settings: one ScrollView and one back button', async () => {
    const utils = renderScreen(<SettingsScreen />);
    await waitFor(() => expect(utils.getByTestId('settings-user-email')).toBeTruthy());
    expect(utils.UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
    expect(utils.getAllByTestId('settings-back-button')).toHaveLength(1);
  });

  it('Profile: one ScrollView and one back button', async () => {
    const utils = renderScreen(<ProfileScreen />);
    await waitFor(() => expect(utils.getByTestId('profile-screen')).toBeTruthy());
    expect(utils.UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
    expect(utils.getAllByTestId('profile-back-button')).toHaveLength(1);
  });

  it('Notifications: one ScrollView and one back button', async () => {
    const utils = renderScreen(<NotificationsScreen />);
    await waitFor(() => expect(utils.getByTestId('notifications-screen')).toBeTruthy());
    expect(utils.UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
    expect(utils.getAllByTestId('notifications-back-button')).toHaveLength(1);
  });
});
