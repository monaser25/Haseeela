import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import { render, fireEvent, waitFor, cleanup, act, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientsScreen from '../(app)/(tabs)/clients';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider, useAuth } from '../../auth';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { useCreateClient, useArchiveClient, type FinancialSnapshot } from '../../api';
import type { Client, Transaction } from '@haseela/shared';
import {
  mockServer,
  createTestQueryClient,
  setNetworkOnline,
  resetNetworkOnline,
  defaultMockPreferences,
} from '../../test';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
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

type OverviewConsumer = {
  resolve: (data: FinancialSnapshot) => void;
  reject: (err: unknown) => void;
};

let activeOverviewConsumer: OverviewConsumer | null = null;

function waitForNextOverviewConsumed(): Promise<FinancialSnapshot> {
  return new Promise<FinancialSnapshot>((resolve, reject) => {
    activeOverviewConsumer = { resolve, reject };
  });
}

function installFetchBoundary() {
  activeOverviewConsumer = null;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await mockServer.fetchHandler(input, init);
    const urlStr = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (method === 'GET' && urlStr.includes('/api/dashboard/overview')) {
      const origJson = res.json.bind(res);
      res.json = async () => {
        try {
          const data = (await origJson()) as FinancialSnapshot;
          if (activeOverviewConsumer) {
            const consumer = activeOverviewConsumer;
            activeOverviewConsumer = null;
            consumer.resolve(data);
          }
          return data;
        } catch (err) {
          if (activeOverviewConsumer) {
            const consumer = activeOverviewConsumer;
            activeOverviewConsumer = null;
            consumer.reject(err);
          }
          throw err;
        }
      };
    }
    return res;
  };
}

const sampleClients: Client[] = [
  {
    id: 'client-active-1',
    name: 'Northwind Studios',
    company: 'Northwind LLC',
    email: 'info@northwind.com',
    revenue: 2400,
    clientType: 'COMPANY',
    status: 'ACTIVE',
    paymentType: 'retainer',
    billingDay: 1,
    nextBillingDate: '2026-04-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'client-active-2',
    name: 'Helia Botanicals',
    company: 'Helia Design',
    email: 'contact@helia.com',
    revenue: 3200,
    clientType: 'COMPANY',
    status: 'ACTIVE',
    paymentType: 'onetime',
    paymentDate: '2026-03-25',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'client-archived-1',
    name: 'Old Legacy Client',
    company: 'Old Corp',
    email: 'old@example.com',
    revenue: 1500,
    clientType: 'INDIVIDUAL',
    status: 'INACTIVE',
    paymentType: 'retainer',
    archivedAt: '2026-02-15T00:00:00.000Z',
    createdAt: '2025-10-01T00:00:00.000Z',
    updatedAt: '2026-02-15T00:00:00.000Z',
  },
];

const sampleTransactions: Transaction[] = [
  {
    id: 'tx-1',
    name: 'Northwind Retainer March',
    amount: 2400,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2026-03-01',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-active-1',
  },
  {
    id: 'tx-2',
    name: 'Northwind Pending Milestone',
    amount: 1000,
    type: 'INCOME',
    status: 'PENDING', // Pending: must NOT count towards completed revenue
    date: '2026-03-15',
    expectedDate: '2026-03-15',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-active-1',
  },
  {
    id: 'tx-3',
    name: 'Helia Botanicals Branding',
    amount: 3200,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2026-03-20',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-active-2',
  },
  {
    id: 'tx-4',
    name: 'Office Supplies',
    amount: 150,
    type: 'EXPENSE', // Expense: must NOT count towards revenue
    status: 'COMPLETED',
    date: '2026-03-10',
    sourceType: 'manual',
    categoryId: 'OPERATIONS',
  },
];

describe('ClientsScreen Tab', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    setNetworkOnline(true);

    mockServer.reset({
      clients: sampleClients,
      transactions: sampleTransactions,
      preferences: defaultMockPreferences,
    });
    installFetchBoundary();

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
    activeOverviewConsumer = null;
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

  function getProvidersWrapper(
    initialLocale: 'en' | 'ar' = 'en',
    themePreference: 'light' | 'dark' = 'light'
  ) {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    return ({ children }: { children: React.ReactNode }) => (
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={testQueryClient}>
          <AuthProvider>
            <AuthenticatedGate>
              <ThemeProvider initialPreference={themePreference}>
                <I18nProvider initialLocale={initialLocale}>
                  {children}
                </I18nProvider>
              </ThemeProvider>
            </AuthenticatedGate>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  function renderClientsScreen(
    initialLocale: 'en' | 'ar' = 'en',
    themePreference: 'light' | 'dark' = 'light'
  ) {
    const Wrapper = getProvidersWrapper(initialLocale, themePreference);
    return render(<ClientsScreen />, { wrapper: Wrapper });
  }

  it('renders loading indicator when overview is loading with no cache', async () => {
    mockServer.setPending('/api/dashboard/overview');

    renderClientsScreen();
    expect(await screen.findByText(/Loading/)).toBeTruthy();
    expect(screen.queryByTestId('clients-list')).toBeNull();

    mockServer.resolvePending('/api/dashboard/overview');
  });

  it('renders error state with retry button when query fails without cache', async () => {
    mockServer.setError('/api/dashboard/overview', 500, { error: 'Server exploded' });

    const { findByText } = renderClientsScreen();
    expect(await findByText('Server exploded')).toBeTruthy();
    expect(await findByText('Try again')).toBeTruthy();
  });

  it('uses the client list as the only scroll container (no list nested in a ScrollView)', async () => {
    const { findByTestId, UNSAFE_getAllByType } = renderClientsScreen();
    await findByTestId('clients-list');
    expect(UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
  });

  it('renders compact header with title, add button, and archive toggle', async () => {
    const { findByText, getByTestId } = renderClientsScreen();

    expect(await findByText('Clients')).toBeTruthy();
    expect(getByTestId('clients-add-button')).toBeTruthy();
    expect(getByTestId('clients-toggle-archive-button')).toBeTruthy();
  });

  it('calculates revenue summary strictly from real completed income transactions', async () => {
    const { findByTestId, findByText, getAllByText } = renderClientsScreen();

    // Northwind (2400) + Helia (3200) = 5600 total completed revenue.
    // tx-2 is PENDING (1000) so it must NOT be included in completed revenue.
    // tx-4 is EXPENSE (150) so it must NOT be included.
    const revenueCard = await findByTestId('client-revenue-card');
    expect(revenueCard).toBeTruthy();

    // Check $5,600 is rendered
    expect(await findByText('⁦5,600.00 $⁩')).toBeTruthy();

    // Check Helia Botanicals is shown in the revenue card
    expect(getAllByText(/Helia Botanicals/).length).toBeGreaterThanOrEqual(1);
  });

  it('filters clients list by default to active clients', async () => {
    const { findByTestId, queryByTestId } = renderClientsScreen();

    // Active clients appear
    expect(await findByTestId('client-row-client-active-1')).toBeTruthy();
    expect(await findByTestId('client-row-client-active-2')).toBeTruthy();

    // Archived client does NOT appear in active filter
    expect(queryByTestId('client-row-client-archived-1')).toBeNull();
  });

  it('switches filter between active, archived, and all', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderClientsScreen();

    await findByTestId('client-row-client-active-1');

    // Click "Archived" chip
    fireEvent.press(getByTestId('clients-filter-archived'));
    expect(await findByTestId('client-row-client-archived-1')).toBeTruthy();
    expect(queryByTestId('client-row-client-active-1')).toBeNull();
    expect(queryByTestId('client-row-client-active-2')).toBeNull();

    // Click "All" chip
    fireEvent.press(getByTestId('clients-filter-all'));
    expect(await findByTestId('client-row-client-active-1')).toBeTruthy();
    expect(await findByTestId('client-row-client-active-2')).toBeTruthy();
    expect(await findByTestId('client-row-client-archived-1')).toBeTruthy();
  });

  it('searches clients by name, company, or email and supports clear', async () => {
    const { findByTestId, getByTestId, queryByTestId } = renderClientsScreen();

    await findByTestId('client-row-client-active-1');

    // Search by company "Helia Design"
    fireEvent.changeText(getByTestId('clients-search-input'), 'Helia Design');
    expect(await findByTestId('client-row-client-active-2')).toBeTruthy();
    expect(queryByTestId('client-row-client-active-1')).toBeNull();

    // Clear search using clear button
    fireEvent.press(getByTestId('clients-search-clear'));
    expect(await findByTestId('client-row-client-active-1')).toBeTruthy();
    expect(await findByTestId('client-row-client-active-2')).toBeTruthy();
  });

  it('navigates to /client/new when add button is pressed', async () => {
    const { findByTestId, getByTestId } = renderClientsScreen();

    await findByTestId('clients-list');
    fireEvent.press(getByTestId('clients-add-button'));

    expect(mockPush).toHaveBeenCalledWith('/client/new');
  });

  it('navigates to /client/[id] when a client row is pressed', async () => {
    const { findByTestId, getByTestId } = renderClientsScreen();

    await findByTestId('clients-list');
    fireEvent.press(getByTestId('client-row-client-active-1'));

    expect(mockPush).toHaveBeenCalledWith('/client/client-active-1');
  });

  it('displays empty state when list has no clients', async () => {
    mockServer.reset({
      clients: [],
      transactions: [],
      preferences: defaultMockPreferences,
    });

    const { findByTestId, findByText } = renderClientsScreen();
    expect(await findByTestId('clients-empty-state')).toBeTruthy();
    expect(await findByText('No clients yet')).toBeTruthy();
  });

  it('shows offline banner and disables add button when offline', async () => {
    setNetworkOnline(false);

    const { findByText, getByTestId } = renderClientsScreen();

    expect(await findByText('You are offline. Client modifications are disabled.')).toBeTruthy();

    const addBtn = getByTestId('clients-add-button');
    fireEvent.press(addBtn);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('refreshes clients list when a new client is created or archived via real production mutation and overview invalidation', async () => {
    function ClientTestDriver() {
      const createMutation = useCreateClient();
      const archiveMutation = useArchiveClient();

      return (
        <>
          <ClientsScreen />
          <Pressable
            testID="driver-create-client"
            onPress={() =>
              createMutation.mutateAsync({
                name: 'Bright Future Co',
                company: 'Bright Future LLC',
                revenue: 5000,
                clientType: 'COMPANY',
                status: 'ACTIVE',
                paymentType: 'onetime',
              })
            }
          />
          <Pressable
            testID="driver-archive-client"
            onPress={() => archiveMutation.mutateAsync('client-active-1')}
          />
        </>
      );
    }

    const Wrapper = getProvidersWrapper('en', 'light');
    const { findByTestId, queryByTestId, getByTestId } = render(<ClientTestDriver />, {
      wrapper: Wrapper,
    });

    // Initial load: Northwind Studios (client-active-1) is present
    expect(await findByTestId('client-row-client-active-1')).toBeTruthy();

    // Trigger REAL production create mutation via HTTP POST /api/clients/create with HTTP barrier on overview refetch
    mockServer.setPending('/api/dashboard/overview', 'GET');
    const createOverviewPromise = waitForNextOverviewConsumed();
    const createPromise = fireEvent.press(getByTestId('driver-create-client'));
    await createPromise;
    expect(mockServer.getRequestCount('POST', '/api/clients/create')).toBe(1);
    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/dashboard/overview', 'GET')).toBe(1);
    });
    await act(async () => {
      mockServer.resolvePending('/api/dashboard/overview', undefined, 200, 'GET');
      await createOverviewPromise;
    });

    // Overview refetch completes and renders new client
    await waitFor(() => {
      expect(screen.getAllByText('Bright Future Co').length).toBeGreaterThanOrEqual(1);
    });

    // Trigger REAL production archive mutation via HTTP DELETE /api/clients/delete/client-active-1 with HTTP barrier
    mockServer.setPending('/api/dashboard/overview', 'GET');
    const archiveOverviewPromise = waitForNextOverviewConsumed();
    const phaseTrace: Array<{ phase: string; time: number }> = [];
    const recordPhase = (phase: string) => phaseTrace.push({ phase, time: Date.now() });

    try {
      recordPhase('archive-press');
      const archivePromise = fireEvent.press(getByTestId('driver-archive-client'));
      recordPhase('await-mutation-promise');
      await archivePromise;
      recordPhase('mutation-promise-settled');

      // 1. DELETE has dispatched and completed
      expect(mockServer.getRequestCount('DELETE', '/api/clients/delete/client-active-1')).toBe(1);

      // 2. Invalidation GET overview has dispatched and is held at the pending barrier
      await waitFor(() => {
        expect(mockServer.getPendingCount('/api/dashboard/overview', 'GET')).toBe(1);
      });
      recordPhase('get-overview-held');

      // 3. DETERMINISTIC TEMPORAL PROOF: While the GET barrier is held and the archiveMutation
      // promise has ALREADY settled, the active client row is STILL PRESENT in the public UI.
      // This disproves the older driver assumption that "mutateAsync completion means archived UI is ready".
      expect(queryByTestId('client-row-client-active-1')).toBeTruthy();
      recordPhase('temporal-proof-active-row-present');

      // 4. Release barrier and await actual response body consumption inside async act
      let consumedOverview: FinancialSnapshot | undefined;
      await act(async () => {
        mockServer.resolvePending('/api/dashboard/overview', undefined, 200, 'GET');
        recordPhase('barrier-released');
        consumedOverview = await archiveOverviewPromise;
        recordPhase('body-consumed');
      });

      // 5. Assert actual wire response payload status and archive field
      const wireClient = consumedOverview?.clients?.find((c: Client) => c.id === 'client-active-1');
      expect(wireClient?.status).toBe('INACTIVE');
      expect(Boolean(wireClient?.archivedAt)).toBe(true);

      // 6. Assert public active row gone
      await waitFor(() => {
        expect(queryByTestId('client-row-client-active-1')).toBeNull();
      });
      recordPhase('ui-row-removed');
      expect(mockServer.getRequestCount('DELETE', '/api/clients/delete/client-active-1')).toBe(1);

      // 7. Switch to archived filter: client-active-1 is now visible as archived
      fireEvent.press(getByTestId('clients-filter-archived'));
      expect(await findByTestId('client-row-client-active-1')).toBeTruthy();
      recordPhase('ui-archived-filter-verified');
    } catch (err) {
      console.error('[ClientsArchiveTraceFailure]', {
        phases: phaseTrace,
        deleteCount: mockServer.getRequestCount('DELETE', '/api/clients/delete/client-active-1'),
        pendingOverview: mockServer.getPendingCount('/api/dashboard/overview', 'GET'),
        activeRowInDOM: Boolean(queryByTestId('client-row-client-active-1')),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Switch to archived filter: client-active-1 is now visible as archived
    fireEvent.press(getByTestId('clients-filter-archived'));
    expect(await findByTestId('client-row-client-active-1')).toBeTruthy();
  });

  it('renders cleanly in Arabic (RTL) and Dark mode', async () => {
    const { findByText, getByTestId } = renderClientsScreen('ar', 'dark');

    // Header in Arabic
    expect(await findByText('العملاء')).toBeTruthy();
    expect(getByTestId('clients-list')).toBeTruthy();
  });
});
