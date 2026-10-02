import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import { render, fireEvent, waitFor, act, cleanup, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubscriptionsScreen from '../(app)/subscriptions';
import MoreScreen from '../(app)/(tabs)/more';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider, useAuth } from '../../auth';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { useCreateSubscription, useUpdateSubscription, useArchiveSubscription } from '../../api';
import type { Subscription } from '@haseela/shared';
import {
  mockServer,
  createTestQueryClient,
  setNetworkOnline,
  resetNetworkOnline,
  defaultMockPreferences,
} from '../../test';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
}));

function AuthenticatedGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return null;
  }
  return <>{children}</>;
}

const originalFetch = global.fetch;

// Create target dates relative to now so due soon is deterministic
const now = new Date();
const in3Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12)
  .toISOString()
  .slice(0, 10);
const in20Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20, 12)
  .toISOString()
  .slice(0, 10);

const sampleSubscriptions: Subscription[] = [
  {
    id: 'sub-figma',
    name: 'Figma Professional',
    amount: 15,
    cycle: 'MONTHLY',
    billingCycle: 'MONTHLY',
    billingDay: 3,
    nextBillingDate: in3Days, // due in 3 days -> due soon
    status: 'ACTIVE',
    notes: 'Design team seat',
  },
  {
    id: 'sub-adobe',
    name: 'Adobe Creative Cloud',
    amount: 120,
    cycle: 'YEARLY',
    billingCycle: 'YEARLY',
    billingDay: 14,
    nextBillingDate: in20Days, // due in 20 days -> not due soon
    status: 'ACTIVE',
    notes: 'Annual license',
  },
  {
    id: 'sub-vercel',
    name: 'Vercel Pro',
    amount: 60,
    cycle: 'QUARTERLY',
    billingCycle: 'QUARTERLY',
    billingDay: 1,
    nextBillingDate: in20Days,
    status: 'ACTIVE',
  },
  {
    id: 'sub-archived',
    name: 'Archived Spotify',
    amount: 10,
    cycle: 'MONTHLY',
    billingCycle: 'MONTHLY',
    billingDay: 5,
    nextBillingDate: in3Days,
    status: 'INACTIVE',
    archivedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('SubscriptionsScreen & More Navigation', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    setNetworkOnline(true);

    mockServer.reset({
      subscriptions: sampleSubscriptions,
      transactions: [],
      preferences: defaultMockPreferences,
    });
    global.fetch = mockServer.fetchHandler;

    const mockSession = {
      access_token: 'mock-test-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    };

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: mockSession,
          },
          error: null,
        }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    } as any);

    testQueryClient = createTestQueryClient();
  });

  afterEach(async () => {
    cleanup();
    resetNetworkOnline();
    testQueryClient.clear();
    testQueryClient.getMutationCache().clear();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
    setSupabaseClientForTesting(null);
  });

  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  const renderWithProviders = (ui: React.ReactElement, locale: 'en' | 'ar' = 'en') => {
    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={testQueryClient}>
          <AuthProvider>
            <AuthenticatedGate>
              <ThemeProvider>
                <I18nProvider initialLocale={locale}>{ui}</I18nProvider>
              </ThemeProvider>
            </AuthenticatedGate>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  it('navigates from More tab to /(app)/subscriptions', async () => {
    renderWithProviders(<MoreScreen />);

    const link = await screen.findByTestId('more-subscriptions-link');
    expect(link).toBeTruthy();
    fireEvent.press(link);

    expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions');
  });

  it('uses the subscription list as the only scroll container (no list nested in a ScrollView)', async () => {
    const { findByTestId, UNSAFE_getAllByType } = renderWithProviders(<SubscriptionsScreen />);
    await findByTestId('subscriptions-list');
    expect(UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
  });

  it('renders subscriptions list and computes monthly burden correctly', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    // Wait for list to load
    await findByTestId('subscriptions-list');

    // Monthly burden calculation:
    // Figma (Monthly 15) = 15
    // Adobe (Yearly 120 / 12) = 10
    // Vercel (Quarterly 60 / 3) = 20
    // Total burden = 15 + 10 + 20 = $45.00
    // Active count = 3 (Figma, Adobe, Vercel)
    // Due soon count = 1 (Figma)
    const burdenAmount = getByTestId('subscriptions-burden-amount');
    expect(burdenAmount.props.children).toContain('45.00');

    const burdenStats = getByTestId('subscriptions-burden-stats');
    expect(burdenStats.props.children).toContain('3 active');
    expect(burdenStats.props.children).toContain('1 due soon');

    // Active rows visible
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();
    expect(getByTestId('subscription-row-sub-adobe')).toBeTruthy();
    expect(getByTestId('subscription-row-sub-vercel')).toBeTruthy();

    // Archived subscription should NOT be visible by default
    expect(queryByTestId('subscription-row-sub-archived')).toBeNull();
  });

  it('renders localized subscription rows with /mo translation in Arabic', async () => {
    const { findByTestId, getByText, getAllByText } = renderWithProviders(
      <SubscriptionsScreen />,
      'ar'
    );

    await findByTestId('subscriptions-list');

    // In Arabic locale, Monthly is 'شهري', and perMonth is '{amount}/شه��'
    expect(getAllByText('شهري').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/شهر/).length).toBeGreaterThanOrEqual(1);
  });

  it('filters by cycle chips (All, Monthly, Quarterly, Yearly)', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');

    // Filter Monthly
    fireEvent.press(getByTestId('subscriptions-chip-monthly'));
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();
    expect(queryByTestId('subscription-row-sub-adobe')).toBeNull();
    expect(queryByTestId('subscription-row-sub-vercel')).toBeNull();

    // Filter Yearly
    fireEvent.press(getByTestId('subscriptions-chip-yearly'));
    expect(queryByTestId('subscription-row-sub-figma')).toBeNull();
    expect(getByTestId('subscription-row-sub-adobe')).toBeTruthy();
    expect(queryByTestId('subscription-row-sub-vercel')).toBeNull();

    // Filter Quarterly
    fireEvent.press(getByTestId('subscriptions-chip-quarterly'));
    expect(queryByTestId('subscription-row-sub-figma')).toBeNull();
    expect(queryByTestId('subscription-row-sub-adobe')).toBeNull();
    expect(getByTestId('subscription-row-sub-vercel')).toBeTruthy();

    // Filter All
    fireEvent.press(getByTestId('subscriptions-chip-all'));
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();
    expect(getByTestId('subscription-row-sub-adobe')).toBeTruthy();
    expect(getByTestId('subscription-row-sub-vercel')).toBeTruthy();
  });

  it('toggles archive view to see archived subscriptions', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');

    // Toggle archive
    fireEvent.press(getByTestId('subscriptions-toggle-archive-button'));

    // Now archived item is visible, active items are hidden
    expect(getByTestId('subscription-row-sub-archived')).toBeTruthy();
    expect(queryByTestId('subscription-row-sub-figma')).toBeNull();
    expect(queryByTestId('subscription-row-sub-adobe')).toBeNull();
  });

  it('searches subscriptions by name and notes and clears search', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');

    const searchInput = getByTestId('subscriptions-search-input');

    // Search by name
    fireEvent.changeText(searchInput, 'Adobe');
    expect(getByTestId('subscription-row-sub-adobe')).toBeTruthy();
    expect(queryByTestId('subscription-row-sub-figma')).toBeNull();

    // Search by note
    fireEvent.changeText(searchInput, 'team seat');
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();
    expect(queryByTestId('subscription-row-sub-adobe')).toBeNull();

    // Clear search
    fireEvent.press(getByTestId('subscriptions-search-clear'));
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();
    expect(getByTestId('subscription-row-sub-adobe')).toBeTruthy();
  });

  it('navigates to subscription detail on row press', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');

    fireEvent.press(getByTestId('subscription-row-sub-figma'));
    expect(mockPush).toHaveBeenCalledWith('/subscription/sub-figma');
  });

  it('navigates to add subscription on plus button press', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');

    fireEvent.press(getByTestId('subscriptions-add-button'));
    expect(mockPush).toHaveBeenCalledWith('/subscription/new');
  });

  it('navigates back on back button press', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');

    fireEvent.press(getByTestId('subscriptions-back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders cold offline screen when offline with empty cache', async () => {
    setNetworkOnline(false);

    // Empty cache and empty state
    mockServer.reset({ subscriptions: [] });

    const { findByTestId, getByText } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-offline-screen');
    expect(
      getByText(/needs a connection to load your latest clients, subscriptions/)
    ).toBeTruthy();
  });

  it('keeps cached subscriptions readable and shows stale data banner on background error', async () => {
    // First load succeeds and populates cache
    const { findByTestId, getByTestId, getByText } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-list');
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();

    // Now background refetch fails
    mockServer.setError('/api/dashboard/overview', 500, { message: 'Server unavailable' });
    try {
      await testQueryClient.refetchQueries({ queryKey: ['overview', 'user-123'] });
    } catch {
      // expected
    }

    // Cached data remains readable, banner indicates stale cached data
    await waitFor(() => {
      expect(getByText(/Using locally cached data/)).toBeTruthy();
    });
    expect(getByTestId('subscription-row-sub-figma')).toBeTruthy();
  });

  it('renders error state and retries on fetch failure', async () => {
    mockServer.setError('/api/dashboard/overview', 500, {
      message: 'Server error loading overview',
    });

    const { findByTestId, getByText } = renderWithProviders(
      <SubscriptionsScreen />
    );

    await findByTestId('subscriptions-error-screen');
    expect(getByText('Server error loading overview')).toBeTruthy();

    // Clear error and retry
    mockServer.clearError('/api/dashboard/overview');
    fireEvent.press(getByText('Try again'));

    await findByTestId('subscriptions-list');
  });

  it('visibly updates monthly burden and rows after a real mutation and overview invalidation', async () => {
    function SubscriptionsTestDriver() {
      const updateMutation = useUpdateSubscription();
      const createMutation = useCreateSubscription();
      const archiveMutation = useArchiveSubscription();
      return (
        <>
          <SubscriptionsScreen />
          <Pressable
            testID="driver-update-sub"
            onPress={() =>
              updateMutation.mutateAsync({
                id: 'sub-figma',
                updates: { amount: 30 },
              })
            }
          />
          <Pressable
            testID="driver-create-sub"
            onPress={() =>
              createMutation.mutateAsync({
                name: 'Cloudflare Zero Trust',
                amount: 25,
                cycle: 'MONTHLY',
                billingDay: 1,
                nextBillingDate: '2026-05-01',
                status: 'ACTIVE',
              })
            }
          />
          <Pressable
            testID="driver-archive-sub"
            onPress={() => archiveMutation.mutateAsync('sub-adobe')}
          />
        </>
      );
    }

    const { findByTestId, getByTestId, queryByTestId, findByText } = renderWithProviders(
      <SubscriptionsTestDriver />
    );

    await findByTestId('subscriptions-list');
    expect(getByTestId('subscriptions-burden-amount').props.children).toContain('45.00');

    // 1. Real UPDATE mutation through production hook (HTTP PUT -> onSuccess invalidation -> GET overview)
    mockServer.setPending('/api/dashboard/overview', 'GET');
    const updatePromise = fireEvent.press(getByTestId('driver-update-sub'));
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/dashboard/overview', 'GET')).toBe(1);
    });
    await act(async () => {
      mockServer.resolvePending('/api/dashboard/overview', undefined, 200, 'GET');
    });
    await updatePromise;
    expect(mockServer.getRequestCount('PUT', '/api/subscriptions/update/sub-figma')).toBe(1);
    await waitFor(() => {
      expect(getByTestId('subscriptions-burden-amount').props.children).toContain('60.00');
    });

    // 2. Real CREATE mutation through production hook (HTTP POST -> onSuccess invalidation -> GET overview)
    mockServer.setPending('/api/dashboard/overview', 'GET');
    const createPromise = fireEvent.press(getByTestId('driver-create-sub'));
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/dashboard/overview', 'GET')).toBe(1);
    });
    await act(async () => {
      mockServer.resolvePending('/api/dashboard/overview', undefined, 200, 'GET');
    });
    await createPromise;
    expect(mockServer.getRequestCount('POST', '/api/subscriptions/create')).toBe(1);
    expect(await findByText('Cloudflare Zero Trust')).toBeTruthy();
    await waitFor(() => {
      expect(getByTestId('subscriptions-burden-amount').props.children).toContain('85.00');
    });

    // 3. Real ARCHIVE mutation through production hook (HTTP DELETE -> onSuccess invalidation -> GET overview)
    mockServer.setPending('/api/dashboard/overview', 'GET');
    const archivePromise = fireEvent.press(getByTestId('driver-archive-sub'));
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/dashboard/overview', 'GET')).toBe(1);
    });
    expect(mockServer.getRequestCount('DELETE', '/api/subscriptions/delete/sub-adobe')).toBe(1);

    await act(async () => {
      mockServer.resolvePending('/api/dashboard/overview', undefined, 200, 'GET');
    });
    await archivePromise;

    // Adobe removed from active list and burden updates to $75.00
    await waitFor(() => {
      expect(queryByTestId('subscription-row-sub-adobe')).toBeNull();
    });
    expect(mockServer.getRequestCount('DELETE', '/api/subscriptions/delete/sub-adobe')).toBe(1);
    await waitFor(() => {
      expect(getByTestId('subscriptions-burden-amount').props.children).toContain('75.00');
    });
  });
});
