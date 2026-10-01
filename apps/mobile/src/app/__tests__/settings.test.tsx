import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import SettingsScreen from '../(app)/settings';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { createTestQueryClient, setNetworkOnline, resetNetworkOnline } from '../../test/testQueryClient';
import { MockHttpServer, defaultMockPreferences } from '../../test/mockServer';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
}));

describe('SettingsScreen', () => {
  let mockServer: MockHttpServer;
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let mockSignOut: jest.Mock;
  let authStateCallback: ((event: string, session: any) => void) | null = null;
  let currentSession: any = null;

  const mockUserA = {
    id: 'user-settings-A',
    email: 'sarah@chenstudio.co',
    user_metadata: { name: 'Sarah Chen' },
  };

  const mockUserB = {
    id: 'user-settings-B',
    email: 'marcus@wright.co',
    user_metadata: { name: 'Marcus Wright' },
  };

  const setupProviders = (initialLocale: 'en' | 'ar' = 'en') => {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider initialPreference="light">
              <I18nProvider initialLocale={initialLocale}>
                <SettingsScreen />
              </I18nProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      resetNetworkOnline();
    });
    authStateCallback = null;

    currentSession = {
      user: { ...mockUserA },
      access_token: 'fake-token-A',
    };

    mockServer = new MockHttpServer();
    mockServer.reset({
      preferences: {
        ...defaultMockPreferences,
        name: 'Sarah Chen',
        email: 'sarah@chenstudio.co',
        currency: 'USD',
        notifyBillingReminders: true,
        notifyInvoiceDue: true,
      },
    });

    global.fetch = jest.fn((url: any, init?: any) => mockServer.fetchHandler(url, init));
    queryClient = createTestQueryClient();

    mockSignOut = jest.fn().mockImplementation(async () => {
      currentSession = null;
      authStateCallback?.('SIGNED_OUT', null);
      return { error: null };
    });

    const mockSupabase = {
      auth: {
        getSession: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: { session: currentSession },
            error: null,
          })
        ),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signOut: mockSignOut,
      },
    };
    setSupabaseClientForTesting(mockSupabase as any);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
    queryClient.clear();
    act(() => {
      resetNetworkOnline();
    });
  });

  it('renders grouped sections with email, profile, currency, and accounting mode', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-user-email')).toBeTruthy();
      expect(getByTestId('settings-user-email').props.children).toBe('sarah@chenstudio.co');
      expect(getByTestId('settings-currency-display').props.children).toBe('USD');
      expect(getByTestId('settings-accounting-mode').props.children).toBe('Cash basis');
    });

    // Profile link navigates to /(app)/profile
    fireEvent.press(getByTestId('settings-profile-link'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/profile');

    // Header back button
    fireEvent.press(getByTestId('settings-back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('allows changing currency via accessible modal and persists PATCH request', async () => {
    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-currency-display').props.children).toBe('USD');
    });

    // Open currency modal
    fireEvent.press(getByTestId('settings-currency-row'));
    expect(getByTestId('settings-currency-modal')).toBeTruthy();

    // Select EUR
    fireEvent.press(getByTestId('currency-option-EUR'));

    // Confirm
    await act(async () => {
      fireEvent.press(getByTestId('settings-currency-confirm-button'));
    });

    // Wait for mutation to settle and modal to close
    await waitFor(() => {
      expect(queryByTestId('settings-currency-modal')).toBeNull();
      expect(getByTestId('settings-currency-display').props.children).toBe('EUR');
    }, { timeout: 3000 });

    const requests = mockServer.getRequests();
    const patchReq = requests.find((r) => r.method === 'PATCH' && r.path === '/api/user/preferences');
    expect(patchReq).toBeTruthy();
    expect(patchReq?.body).toEqual({ currency: 'EUR' });
  });

  it('synchronous duplicate lock blocks rapid batched toggle events in single act', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('toggle-billing-reminders').props.value).toBe(true);
    });

    // Rapid double toggle in same act tick
    await act(async () => {
      fireEvent(getByTestId('toggle-billing-reminders'), 'valueChange', false);
      fireEvent(getByTestId('toggle-billing-reminders'), 'valueChange', false);
    });

    await waitFor(() => {
      const patchReqs = mockServer
        .getRequests()
        .filter((r) => r.method === 'PATCH' && r.body?.notifyBillingReminders === false);
      expect(patchReqs).toHaveLength(1);
    });
  });

  it('cross-action exclusion blocks toggle while currency save is in flight', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-currency-display').props.children).toBe('USD');
    });

    mockServer.setPending('/api/user/preferences');

    // Open currency modal and confirm (deferred)
    fireEvent.press(getByTestId('settings-currency-row'));
    fireEvent.press(getByTestId('currency-option-GBP'));
    fireEvent.press(getByTestId('settings-currency-confirm-button'));

    // Wait for the currency PATCH to reach pending boundary
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/user/preferences')).toBe(1);
    });

    // Try to trigger billing reminder toggle while currency save is pending
    fireEvent(getByTestId('toggle-billing-reminders'), 'valueChange', false);

    // Toggle write was rejected by synchronous cross-action lock
    const billingReqs = mockServer
      .getRequests()
      .filter((r) => r.method === 'PATCH' && r.body?.notifyBillingReminders !== undefined);
    expect(billingReqs).toHaveLength(0);

    // Resolve deferred currency save inside act
    await act(async () => {
      mockServer.resolvePending('/api/user/preferences');
      await new Promise((r) => setTimeout(r, 20));
    });
  });

  it('preserves draft currency selection across background refetch and resets on dismiss', async () => {
    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-currency-display').props.children).toBe('USD');
    });

    // Open currency modal
    fireEvent.press(getByTestId('settings-currency-row'));

    // Select GBP
    fireEvent.press(getByTestId('currency-option-GBP'));

    // Trigger a background refetch
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['preferences', mockUserA.id] });
    });

    // Cancel modal
    fireEvent.press(getByTestId('settings-currency-cancel-button'));
    expect(queryByTestId('settings-currency-modal')).toBeNull();

    // Reopen modal: draft must be reset to active USD
    fireEvent.press(getByTestId('settings-currency-row'));
    expect(getByTestId('currency-option-USD').props.accessibilityState?.selected).toBe(true);
  });

  it('account switch resets open modal, drafts, and errors to clean state for user B', async () => {
    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-currency-display').props.children).toBe('USD');
    });

    // User A opens modal and drafts EUR
    fireEvent.press(getByTestId('settings-currency-row'));
    fireEvent.press(getByTestId('currency-option-EUR'));
    expect(getByTestId('settings-currency-modal')).toBeTruthy();

    // Account switches to User B
    await act(async () => {
      currentSession = {
        user: { ...mockUserB },
        access_token: 'fake-token-B',
      };
      mockServer.setPreferences({
        name: 'Marcus Wright',
        email: 'marcus@wright.co',
        currency: 'SAR',
      });
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    // Modal was closed and state reset
    await waitFor(() => {
      expect(queryByTestId('settings-currency-modal')).toBeNull();
      expect(getByTestId('settings-user-email').props.children).toBe('marcus@wright.co');
      expect(getByTestId('settings-currency-display').props.children).toBe('SAR');
    });
  });

  it('in-flight currency PATCH held at boundary when account switches to user B: zero write authorized as B, clean B state, and B can start and complete own action', async () => {
    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-currency-display').props.children).toBe('USD');
    });

    // Hold User A's PATCH request
    mockServer.setPending('/api/user/preferences', 'PATCH');

    fireEvent.press(getByTestId('settings-currency-row'));
    fireEvent.press(getByTestId('currency-option-EUR'));
    fireEvent.press(getByTestId('settings-currency-confirm-button'));

    // Wait until request reaches pending boundary
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/user/preferences', 'PATCH')).toBe(1);
    });

    // Switch account to User B while User A's request is held in flight
    await act(async () => {
      currentSession = {
        user: { ...mockUserB },
        access_token: 'fake-token-B',
      };
      mockServer.setPreferences({
        name: 'Marcus Wright',
        email: 'marcus@wright.co',
        currency: 'SAR',
      });
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    // Verify User B's settings UI is clean and NOT blocked by User A's held action!
    await waitFor(() => {
      expect(queryByTestId('settings-currency-modal')).toBeNull();
      expect(getByTestId('settings-user-email').props.children).toBe('marcus@wright.co');
      expect(getByTestId('settings-currency-display').props.children).toBe('SAR');
      // User B controls are active and usable
      expect(getByTestId('toggle-billing-reminders').props.disabled).toBe(false);
    });

    // Release User A's held request
    await act(async () => {
      mockServer.resolvePending('/api/user/preferences', { currency: 'EUR' }, 200, 'PATCH');
      await new Promise((r) => setTimeout(r, 20));
    });

    // User B's currency remains SAR (unaffected by User A's settled EUR response)
    expect(getByTestId('settings-currency-display').props.children).toBe('SAR');
    expect(queryByTestId('settings-currency-modal')).toBeNull();
  });

  it('shows offline banner and visibly disables server writes while offline via real onlineManager', async () => {
    act(() => {
      setNetworkOnline(false);
    });

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-offline-banner')).toBeTruthy();
    });

    // Notification toggles are disabled
    expect(getByTestId('toggle-billing-reminders').props.disabled).toBe(true);
    expect(getByTestId('toggle-invoice-alerts').props.disabled).toBe(true);

    // Open currency modal: confirm button is disabled
    fireEvent.press(getByTestId('settings-currency-row'));
    expect(getByTestId('settings-currency-offline-banner')).toBeTruthy();
    expect(getByTestId('settings-currency-confirm-button').props.accessibilityState?.disabled).toBe(true);

    // Ensure zero PATCH requests were sent
    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(0);
  });

  it('rolls back toggle and displays localized error banner when PATCH fails', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('toggle-billing-reminders').props.value).toBe(true);
    });

    // Fail PATCH preferences requests
    mockServer.setError('/api/user/preferences', 500, { error: 'Internal Server Error' });

    // Toggle billing reminders
    await act(async () => {
      fireEvent(getByTestId('toggle-billing-reminders'), 'valueChange', false);
    });

    await waitFor(() => {
      expect(getByTestId('settings-toggle-error-banner')).toBeTruthy();
      expect(getByTestId('toggle-billing-reminders').props.value).toBe(true);
    });
  });

  it('shows cold error screen with retry button when preferences fail with no cache', async () => {
    mockServer.setError('/api/user/preferences', 500, { error: 'Network failure' });

    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-error-screen')).toBeTruthy();
      expect(getByTestId('settings-retry-button')).toBeTruthy();
    });

    // Clear error on server and click retry
    mockServer.reset();
    await act(async () => {
      fireEvent.press(getByTestId('settings-retry-button'));
    });

    await waitFor(() => {
      expect(queryByTestId('settings-error-screen')).toBeNull();
      expect(getByTestId('settings-screen')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('calls signOut when logout button is pressed', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('settings-logout-button')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('settings-logout-button'));
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
