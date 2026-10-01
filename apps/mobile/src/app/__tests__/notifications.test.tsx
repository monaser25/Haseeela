import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import NotificationsScreen from '../(app)/notifications';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { createTestQueryClient, setNetworkOnline, resetNetworkOnline } from '../../test/testQueryClient';
import { MockHttpServer, defaultMockNotifications } from '../../test/mockServer';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
}));

describe('NotificationsScreen', () => {
  let mockServer: MockHttpServer;
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let authStateCallback: ((event: string, session: any) => void) | null = null;
  let currentSession: any = null;

  const mockUserA = {
    id: 'user-notif-A',
    email: 'sarah@chenstudio.co',
  };

  const mockUserB = {
    id: 'user-notif-B',
    email: 'marcus@wright.co',
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
                <NotificationsScreen />
              </I18nProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => resetNetworkOnline());
    authStateCallback = null;

    currentSession = {
      user: { ...mockUserA },
      access_token: 'fake-notif-token-A',
    };

    mockServer = new MockHttpServer();
    mockServer.reset({
      notifications: [...defaultMockNotifications],
    });

    global.fetch = jest.fn((url: any, init?: any) => mockServer.fetchHandler(url, init));
    queryClient = createTestQueryClient();

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
        signOut: jest.fn().mockImplementation(async () => {
          currentSession = null;
          authStateCallback?.('SIGNED_OUT', null);
          return { error: null };
        }),
      },
    };
    setSupabaseClientForTesting(mockSupabase as any);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
    queryClient.clear();
    act(() => resetNetworkOnline());
  });

  it('renders notifications grouped by date with counts and unread dots', async () => {
    const { getByTestId, getByText, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByText('Notifications')).toBeTruthy();
      expect(getByText('All · 3')).toBeTruthy();
      expect(getByText('Unread · 2')).toBeTruthy();
      expect(getByTestId('unread-dot-notif-1')).toBeTruthy();
      expect(getByTestId('unread-dot-notif-2')).toBeTruthy();
    });

    // notif-3 is already read, so it must not have an unread dot
    expect(queryByTestId('unread-dot-notif-3')).toBeNull();

    // Back button
    fireEvent.press(getByTestId('notifications-back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('filters list when switching between All and Unread tabs', async () => {
    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
      expect(getByTestId('notification-row-notif-2')).toBeTruthy();
      expect(getByTestId('notification-row-notif-3')).toBeTruthy();
    });

    // Switch to Unread tab
    fireEvent.press(getByTestId('notif-tab-unread'));

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
      expect(getByTestId('notification-row-notif-2')).toBeTruthy();
      expect(queryByTestId('notification-row-notif-3')).toBeNull();
    });

    // Switch back to All tab
    fireEvent.press(getByTestId('notif-tab-all'));

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-3')).toBeTruthy();
    });
  });

  it('synchronous duplicate lock blocks rapid batched clicks on single notification row', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
    });

    // Rapid double press in same tick
    fireEvent.press(getByTestId('notification-row-notif-1'));
    fireEvent.press(getByTestId('notification-row-notif-1'));

    await waitFor(() => {
      const markReqs = mockServer
        .getRequests()
        .filter((r) => r.method === 'POST' && r.path === '/api/notifications/mark-read' && r.body?.id === 'notif-1');
      expect(markReqs).toHaveLength(1);
    });
  });

  it('cross-action exclusion in both directions between row mark-one and mark-all', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
    });

    // Direction 1: Row tap is pending -> mark-all is blocked
    mockServer.setPending('/api/notifications/mark-read');
    fireEvent.press(getByTestId('notification-row-notif-1'));
    fireEvent.press(getByTestId('notifications-mark-all-button'));

    // Wait for the single row POST to be dispatched
    await waitFor(() => {
      const requestsAfterDir1 = mockServer.getRequests().filter((r) => r.method === 'POST');
      expect(requestsAfterDir1).toHaveLength(1);
      expect(requestsAfterDir1[0].body).toEqual({ id: 'notif-1' });
    });

    // Settle row tap
    mockServer.resolvePending('/api/notifications/mark-read');

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions');
    });

    mockServer.clearRequests();

    // Direction 2: Mark-all is pending -> row tap is blocked
    mockServer.setPending('/api/notifications/mark-read');
    fireEvent.press(getByTestId('notifications-mark-all-button'));
    fireEvent.press(getByTestId('notification-row-notif-2'));

    await waitFor(() => {
      const requestsAfterDir2 = mockServer.getRequests().filter((r) => r.method === 'POST');
      expect(requestsAfterDir2).toHaveLength(1);
      expect(requestsAfterDir2[0].body).toEqual({});
    });

    mockServer.resolvePending('/api/notifications/mark-read');
  });

  it('deferred markRead aborted on account switch: zero navigation, clean B state', async () => {
    mockServer.setPending('/api/notifications/mark-read');

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
    });

    // User A taps row (deferred)
    fireEvent.press(getByTestId('notification-row-notif-1'));

    // Wait until request reaches pending boundary
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/notifications/mark-read')).toBe(1);
    });

    // Switch account to User B while request is held in-flight
    await act(async () => {
      currentSession = {
        user: { ...mockUserB },
        access_token: 'fake-token-B',
      };
      // Keep pendingResolvers intact by calling setNotifications instead of reset!
      mockServer.setNotifications([
        {
          id: 'notif-b-1',
          type: 'INFO',
          title: 'User B Welcome',
          body: 'Welcome to your workspace',
          link: null,
          read: false,
          refKey: 'welcome-b',
          userId: mockUserB.id,
          createdAt: new Date().toISOString(),
        },
      ]);
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    // Verify User B controls are active and ready BEFORE old User A request is released
    await waitFor(() => {
      expect(getByTestId('notifications-screen')).toBeTruthy();
      expect(getByTestId('notification-row-notif-b-1')).toBeTruthy();
      expect(getByTestId('notif-tab-all')).toBeTruthy();
      expect(getByTestId('notif-tab-unread')).toBeTruthy();
    });

    // Resolve old User A request and drain inside act
    await act(async () => {
      mockServer.resolvePending('/api/notifications/mark-read');
      await new Promise((r) => setTimeout(r, 20));
    });

    // Fences ensure NO navigation occurred for User B from User A's settled action!
    expect(mockPush).not.toHaveBeenCalled();

    // Notifications list still displays clean User B items
    expect(getByTestId('notification-row-notif-b-1')).toBeTruthy();
  });

  it('marks a single notification as read on tap and navigates to allowlisted target', async () => {
    const { getByTestId, queryByTestId, getByText } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
      expect(getByTestId('unread-dot-notif-1')).toBeTruthy();
    });

    // Tap notif-1 (link: /subscriptions)
    fireEvent.press(getByTestId('notification-row-notif-1'));

    await waitFor(() => {
      const markReq = mockServer
        .getRequests()
        .find((r) => r.method === 'POST' && r.path === '/api/notifications/mark-read');
      expect(markReq).toBeTruthy();
      expect(markReq?.body).toEqual({ id: 'notif-1' });

      // Unread count decremented
      expect(getByText('Unread · 1')).toBeTruthy();
      // Navigated to allowlisted route
      expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions');
      // Unread dot removed
      expect(queryByTestId('unread-dot-notif-1')).toBeNull();
    });
  });

  it('marks all notifications as read when Mark all button is pressed', async () => {
    const { getByTestId, queryByTestId, getByText } = setupProviders();

    await waitFor(() => {
      expect(getByText('Unread · 2')).toBeTruthy();
    });

    // Press mark all
    fireEvent.press(getByTestId('notifications-mark-all-button'));

    await waitFor(() => {
      const markAllReq = mockServer
        .getRequests()
        .find(
          (r) =>
            r.method === 'POST' &&
            r.path === '/api/notifications/mark-read' &&
            (!r.body || Object.keys(r.body).length === 0)
        );
      expect(markAllReq).toBeTruthy();

      expect(getByText('Unread · 0')).toBeTruthy();
      expect(queryByTestId('unread-dot-notif-1')).toBeNull();
      expect(queryByTestId('unread-dot-notif-2')).toBeNull();
    });
  });

  it('navigates to parameterized allowlisted invoice destination', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-2')).toBeTruthy();
    });

    // notif-2 has link: '/invoices/inv-0044'
    fireEvent.press(getByTestId('notification-row-notif-2'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/(app)/invoice/inv-0044');
    });
  });

  it('rejects malicious or unknown links and does not navigate', async () => {
    mockServer.setNotifications([
      {
        id: 'notif-evil',
        type: 'INFO',
        title: 'Phishing Attempt',
        body: 'Click here',
        link: 'https://evil.com/steal-data',
        read: false,
        refKey: 'evil-1',
        userId: mockUserA.id,
        createdAt: new Date().toISOString(),
      },
    ]);

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notification-row-notif-evil')).toBeTruthy();
    });

    fireEvent.press(getByTestId('notification-row-notif-evil'));

    await waitFor(() => {
      const markReq = mockServer
        .getRequests()
        .find((r) => r.method === 'POST' && r.body?.id === 'notif-evil');
      expect(markReq).toBeTruthy();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('shows offline banner, prevents read writes, and disables Mark all while offline via real onlineManager', async () => {
    act(() => {
      setNetworkOnline(false);
    });

    // Pre-populate query cache with cached notifications
    queryClient.setQueryData(['notifications', mockUserA.id], {
      notifications: [...defaultMockNotifications],
      unread: 2,
    });

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notifications-offline-banner')).toBeTruthy();
      expect(getByTestId('notifications-mark-all-button').props.accessibilityState?.disabled).toBe(true);
      expect(getByTestId('notification-row-notif-1')).toBeTruthy();
    });

    // Tapping unread row while offline navigates to allowlisted target without sending POST
    fireEvent.press(getByTestId('notification-row-notif-1'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions');
    const markReqs = mockServer.getRequests().filter((r) => r.method === 'POST');
    expect(markReqs).toHaveLength(0);
  });

  it('shows cold error screen with retry button when notifications fail with no cache', async () => {
    mockServer.setError('/api/notifications', 500, { error: 'Network failure' });

    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notifications-error-screen')).toBeTruthy();
      expect(getByTestId('notifications-retry-button')).toBeTruthy();
    });

    // Reset error and retry
    mockServer.reset({ notifications: [...defaultMockNotifications] });
    fireEvent.press(getByTestId('notifications-retry-button'));

    await waitFor(() => {
      expect(queryByTestId('notifications-error-screen')).toBeNull();
      expect(getByTestId('notifications-screen')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('shows empty state when no unread notifications exist in Unread tab', async () => {
    mockServer.setNotifications([
      {
        id: 'notif-read-only',
        type: 'INFO',
        title: 'Already read',
        body: 'Nothing new',
        link: null,
        read: true,
        refKey: 'info-1',
        userId: mockUserA.id,
        createdAt: new Date().toISOString(),
      },
    ]);

    const { getByTestId, getByText } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('notif-tab-unread')).toBeTruthy();
    });

    fireEvent.press(getByTestId('notif-tab-unread'));

    await waitFor(() => {
      expect(getByTestId('notifications-empty-state')).toBeTruthy();
      expect(getByText('No unread notifications')).toBeTruthy();
    });
  });
});
