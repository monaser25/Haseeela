import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MoreScreen from '../(app)/(tabs)/more';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../auth/supabase';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('MoreScreen navigation and entry points', () => {
  let mockSignOut: jest.Mock;

  const mockUser = {
    id: 'user-more-123',
    email: 'sarah@chenstudio.co',
    user_metadata: { name: 'Sarah Chen' },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSignOut = jest.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: mockUser, access_token: 'fake-more-token' } },
          error: null,
        }),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        signOut: mockSignOut,
      },
    };
    setSupabaseClientForTesting(mockSupabase as any);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
  });

  function renderMoreScreen() {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <AuthProvider>
          <ThemeProvider initialPreference="light">
            <I18nProvider initialLocale="en">
              <MoreScreen />
            </I18nProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    );
  }

  it('renders user details and navigates to profile when profile card is pressed', async () => {
    const { getByTestId } = renderMoreScreen();

    await waitFor(() => {
      expect(getByTestId('more-user-name').props.children).toBe('Sarah Chen');
      expect(getByTestId('more-user-email').props.children).toBe('sarah@chenstudio.co');
    });

    fireEvent.press(getByTestId('more-profile-card'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/profile');
  });

  it('navigates to settings, notifications, invoices, and subscriptions via links', async () => {
    const { getByTestId } = renderMoreScreen();

    await waitFor(() => {
      expect(getByTestId('more-settings-link')).toBeTruthy();
      expect(getByTestId('more-notifications-link')).toBeTruthy();
      expect(getByTestId('more-invoices-link')).toBeTruthy();
      expect(getByTestId('more-subscriptions-link')).toBeTruthy();
    });

    fireEvent.press(getByTestId('more-settings-link'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/settings');

    fireEvent.press(getByTestId('more-notifications-link'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/notifications');

    fireEvent.press(getByTestId('more-invoices-link'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/invoices');

    fireEvent.press(getByTestId('more-subscriptions-link'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions');
  });

  it('triggers sign out on sign-out-button press', async () => {
    const { getByTestId } = renderMoreScreen();

    await waitFor(() => {
      expect(getByTestId('sign-out-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('sign-out-button'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('exposes the dark-mode row as a switch that flips with the theme', async () => {
    const { getByTestId } = renderMoreScreen();

    await waitFor(() => {
      expect(getByTestId('theme-toggle')).toBeTruthy();
    });

    expect(getByTestId('theme-toggle').props.accessibilityRole).toBe('switch');
    expect(getByTestId('theme-toggle').props.accessibilityState.checked).toBe(false);

    fireEvent.press(getByTestId('theme-toggle'));

    await waitFor(() => {
      expect(getByTestId('theme-toggle').props.accessibilityState.checked).toBe(true);
    });
  });

  it('shows the language row with its accessibility label and a danger-zone sign-out row', async () => {
    const { getByTestId } = renderMoreScreen();

    await waitFor(() => {
      expect(getByTestId('language-toggle')).toBeTruthy();
    });

    expect(getByTestId('language-toggle').props.accessibilityLabel).toBe('Switch to Arabic language');
    expect(getByTestId('language-toggle').props.accessibilityRole).toBe('button');
    expect(getByTestId('sign-out-button').props.accessibilityLabel).toBe('Log out');
  });
});
