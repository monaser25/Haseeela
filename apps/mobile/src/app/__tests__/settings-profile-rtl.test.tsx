import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
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

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('RTL & Accessibility rendering assertions', () => {
  let mockServer: MockHttpServer;
  let queryClient: ReturnType<typeof createTestQueryClient>;

  const mockUser = {
    id: 'user-rtl-123',
    email: 'sarah@chenstudio.co',
    user_metadata: { name: 'Sarah Chen' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    I18nManager.isRTL = false;

    mockServer = new MockHttpServer();
    mockServer.reset({
      preferences: {
        ...defaultMockPreferences,
        name: 'Sarah Chen',
        email: 'sarah@chenstudio.co',
      },
      notifications: [...defaultMockNotifications],
    });

    global.fetch = jest.fn((url: any, init?: any) => mockServer.fetchHandler(url, init));
    queryClient = createTestQueryClient();

    const mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: mockUser, access_token: 'fake-rtl-token' } },
          error: null,
        }),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    };
    setSupabaseClientForTesting(mockSupabase as any);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
    queryClient.clear();
    I18nManager.isRTL = false;
  });

  function renderWithLocaleAndTheme(
    component: React.ReactElement,
    locale: 'en' | 'ar',
    themePref: 'light' | 'dark'
  ) {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider initialPreference={themePref}>
              <I18nProvider initialLocale={locale}>
                {component}
              </I18nProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  it('renders Settings in Arabic with paired localized labels, accessible controls, and mirrored RTL chevron', async () => {
    I18nManager.isRTL = true;

    const { getByText, getAllByText, getByTestId } = renderWithLocaleAndTheme(
      <SettingsScreen />,
      'ar',
      'dark'
    );

    await waitFor(() => {
      // Arabic section titles
      expect(getByText('الحساب')).toBeTruthy();
      expect(getByText('مساحة العمل')).toBeTruthy();
      expect(getAllByText('المظهر').length).toBeGreaterThanOrEqual(1);
      expect(getByText('الإشعارات')).toBeTruthy();
      expect(getByText('الأساس النقدي')).toBeTruthy();
    });

    // Check accessibility roles on interactive controls
    expect(getByTestId('settings-back-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('settings-profile-link').props.accessibilityRole).toBe('button');
    expect(getByTestId('settings-logout-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('settings-currency-row').props.accessibilityRole).toBe('button');

    // Back arrow is mirrored in RTL by its wrapping View (a transform on the SVG itself renders nothing on Android)
    const backBtn = getByTestId('settings-back-button');
    const arrowIcon = backBtn.findByProps({ size: 22 });
    expect(arrowIcon.parent?.props.style).toEqual({ transform: [{ scaleX: -1 }] });
  });

  it('renders Profile in Arabic with localized fields, accessibility roles, and mirrored RTL chevron', async () => {
    I18nManager.isRTL = true;

    const { getByText, getByTestId } = renderWithLocaleAndTheme(
      <ProfileScreen />,
      'ar',
      'light'
    );

    await waitFor(() => {
      expect(getByText('ملفك الشخصي')).toBeTruthy();
      expect(getByText('المعلومات الشخصية')).toBeTruthy();
      expect(getByText('الأمان')).toBeTruthy();
      expect(getByText('تغيير كلمة المرور')).toBeTruthy();
    });

    expect(getByTestId('profile-back-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('profile-save-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('profile-change-password-button').props.accessibilityRole).toBe('button');

    // Back arrow is mirrored in RTL by its wrapping View (a transform on the SVG itself renders nothing on Android)
    const backBtn = getByTestId('profile-back-button');
    const arrowIcon = backBtn.findByProps({ size: 22 });
    expect(arrowIcon.parent?.props.style).toEqual({ transform: [{ scaleX: -1 }] });
  });

  it('renders Notifications in Arabic with localized groups, filter counts, and mirrored RTL chevron', async () => {
    I18nManager.isRTL = true;

    const { getByText, getByTestId } = renderWithLocaleAndTheme(
      <NotificationsScreen />,
      'ar',
      'dark'
    );

    await waitFor(() => {
      expect(getByText('الإشعارات')).toBeTruthy();
      expect(getByText('تحديد الكل كمقروء')).toBeTruthy();
      expect(getByText('اليوم')).toBeTruthy();
    });

    expect(getByTestId('notifications-back-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('notifications-mark-all-button').props.accessibilityRole).toBe('button');
    expect(getByTestId('notif-tab-all').props.accessibilityRole).toBe('button');
    expect(getByTestId('notif-tab-unread').props.accessibilityRole).toBe('button');

    // Back arrow is mirrored in RTL by its wrapping View (a transform on the SVG itself renders nothing on Android)
    const backBtn = getByTestId('notifications-back-button');
    const arrowIcon = backBtn.findByProps({ size: 22 });
    expect(arrowIcon.parent?.props.style).toEqual({ transform: [{ scaleX: -1 }] });
  });
});
