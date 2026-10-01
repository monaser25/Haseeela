import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionsScreen from '../(app)/(tabs)/transactions';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as onlineModule from '../../query/useIsOnline';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import {
  mockServer,
  createTestQueryClient,
  setNetworkOnline,
  resetNetworkOnline,
  defaultMockTransactions,
  defaultMockClients,
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

jest.mock('../../auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    status: 'signedIn',
  }),
}));

jest.mock('../../query/useIsOnline', () => ({
  useIsOnline: jest.fn(),
}));

const originalFetch = global.fetch;

describe('TransactionsScreen Tab', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    setNetworkOnline(true);

    mockServer.reset();
    global.fetch = mockServer.fetchHandler;

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'mock-test-access-token',
            },
          },
          error: null,
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
    // Flush any pending list update timers inside act
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
    setSupabaseClientForTesting(null);
  });

  function renderTransactionsScreen(initialLocale: 'en' | 'ar' = 'en') {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    const wrap = (node: React.ReactElement) => (
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={testQueryClient}>
          <ThemeProvider initialPreference="light">
            <I18nProvider initialLocale={initialLocale}>
              {node}
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );

    const rendered = render(wrap(<TransactionsScreen />));
    return {
      ...rendered,
      wrap,
    };
  }

  it('renders loading skeleton when overview is loading with no cache', () => {
    mockServer.setPending('/api/dashboard/overview');

    const { getByTestId, queryByTestId } = renderTransactionsScreen();
    expect(getByTestId('transactions-loading-skeleton')).toBeTruthy();
    expect(queryByTestId('transactions-screen')).toBeNull();

    mockServer.resolvePending('/api/dashboard/overview');
  });

  it('renders error state with retry button when query fails', async () => {
    mockServer.setError('/api/dashboard/overview', 500, { error: 'Failed to load transactions' });

    const { getByTestId, getByText } = renderTransactionsScreen();

    await waitFor(() => {
      expect(getByTestId('transactions-error-state')).toBeTruthy();
      expect(getByText('Failed to load transactions')).toBeTruthy();
    });

    // Clear error so retry succeeds
    mockServer.clearError('/api/dashboard/overview');

    const retryBtn = getByTestId('transactions-retry-button');
    fireEvent.press(retryBtn);

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });
  });

  it('renders grouped rows with formatted amounts in USD', async () => {
    const { getByTestId, getByText, getAllByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    expect(getByText('Website Redesign')).toBeTruthy();
    expect(getAllByText('+$3,500.00').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Figma Subscription')).toBeTruthy();
    expect(getAllByText('-$15.00').length).toBeGreaterThanOrEqual(1);
    expect(getByText('App Milestone 1')).toBeTruthy();
  });

  it('renders source badges and status indicators on rows', async () => {
    const { getByTestId } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transaction-row-tx-1')).toBeTruthy();
    });

    const tx1Row = getByTestId('transaction-row-tx-1');
    const a11yLabel = tx1Row.props.accessibilityLabel;
    expect(a11yLabel).toContain('Website Redesign');
    expect(a11yLabel).toContain('+$3,500.00');
    expect(a11yLabel).toContain('Completed');
  });

  it('filters by Income when Income filter chip is pressed', async () => {
    const { getByTestId, queryByText, getByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    const incomeChip = getByTestId('filter-chip-income');
    fireEvent.press(incomeChip);

    expect(getByText('Website Redesign')).toBeTruthy();
    expect(queryByText('Figma Subscription')).toBeNull();
  });

  it('filters by Expense when Expense filter chip is pressed', async () => {
    const { getByTestId, queryByText, getByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    const expenseChip = getByTestId('filter-chip-expense');
    fireEvent.press(expenseChip);

    expect(getByText('Figma Subscription')).toBeTruthy();
    expect(queryByText('Website Redesign')).toBeNull();
  });

  it('filters by Pending when Pending filter chip is pressed', async () => {
    const { getByTestId, queryByText, getByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    const pendingChip = getByTestId('filter-chip-pending');
    fireEvent.press(pendingChip);

    expect(getByText('App Milestone 1')).toBeTruthy();
    expect(queryByText('Website Redesign')).toBeNull();
    expect(queryByText('Figma Subscription')).toBeNull();
  });

  it('searches transactions by name and clears search', async () => {
    const { getByTestId, queryByText, getByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    const searchInput = getByTestId('transactions-search-input');
    fireEvent.changeText(searchInput, 'Figma');

    expect(getByText('Figma Subscription')).toBeTruthy();
    expect(queryByText('Website Redesign')).toBeNull();

    // Clear search
    const clearBtn = getByTestId('transactions-clear-search');
    fireEvent.press(clearBtn);

    expect(getByText('Website Redesign')).toBeTruthy();
    expect(getByText('Figma Subscription')).toBeTruthy();
  });

  it('renders empty state when search finds no transactions', async () => {
    const { getByTestId, getByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    const searchInput = getByTestId('transactions-search-input');
    fireEvent.changeText(searchInput, 'NonexistentTxQuery');

    expect(getByTestId('transactions-empty-state')).toBeTruthy();
    const clearAction = getByTestId('transactions-empty-action');
    expect(clearAction).toBeTruthy();
    fireEvent.press(clearAction);

    // After clearing, transactions reappear
    expect(getByText('Website Redesign')).toBeTruthy();
  });

  it('renders offline banner when offline with cached data', async () => {
    testQueryClient.setQueryData(['overview', 'user-123'], {
      transactions: defaultMockTransactions,
      clients: defaultMockClients,
      subscriptions: [],
    });
    testQueryClient.setQueryData(['preferences', 'user-123'], defaultMockPreferences);

    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
    setNetworkOnline(false);

    const { getByTestId, getByText } = renderTransactionsScreen('en');

    expect(getByTestId('offline-banner')).toBeTruthy();
    // Cached transactions still visible
    expect(getByText('Website Redesign')).toBeTruthy();
  });

  it('navigates to transaction detail when a row is pressed', async () => {
    const { getByTestId } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transaction-row-tx-1')).toBeTruthy();
    });

    const row = getByTestId('transaction-row-tx-1');
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/transaction/[id]',
      params: { id: 'tx-1' },
    });
  });

  it('allows completing a pending payment with date from pending list and verifies real query invalidation updates visible list', async () => {
    const { getByTestId, queryByTestId, getByText } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    // Switch to Pending filter
    fireEvent.press(getByTestId('filter-chip-pending'));
    expect(getByText('App Milestone 1')).toBeTruthy();

    // Press quick complete button
    const completeBtn = getByTestId('quick-complete-tx-3');
    fireEvent.press(completeBtn);

    // Modal appears
    expect(getByTestId('complete-pending-modal')).toBeTruthy();

    // Confirm
    const confirmBtn = getByTestId('complete-modal-confirm');
    await act(async () => {
      fireEvent.press(confirmBtn);
      await Promise.resolve();
    });

    // Verify real hook invalidation refetches and updates the visible list
    await waitFor(() => {
      expect(queryByTestId('quick-complete-tx-3')).toBeNull();
    });

    // Verify real HTTP request was dispatched
    expect(mockServer.getRequestCount('POST', '/api/transactions/pending/tx-3/complete')).toBe(1);
    expect(mockServer.getState().transactions.find((t) => t.id === 'tx-3')?.status).toBe('COMPLETED');
  });

  it('allows reverting a completed transaction that came from pending and verifies real query invalidation updates visible list', async () => {
    const { getByTestId, queryByTestId } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    // tx-4 is completed with expectedDate -> shows quick revert button
    const revertBtn = getByTestId('quick-revert-tx-4');
    fireEvent.press(revertBtn);

    expect(getByTestId('revert-pending-modal')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('revert-modal-confirm'));
      await Promise.resolve();
    });

    // Verify real hook invalidation refetches and updates the visible list
    await waitFor(() => {
      expect(queryByTestId('quick-revert-tx-4')).toBeNull();
    });

    expect(mockServer.getRequestCount('POST', '/api/transactions/pending/tx-4/revert')).toBe(1);
    expect(mockServer.getState().transactions.find((t) => t.id === 'tx-4')?.status).toBe('PENDING');
  });

  it('prevents completion mutation when connectivity drops online -> offline while Complete dialog is open on Transactions tab (no HTTP write and no queued write on reconnect)', async () => {
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    setNetworkOnline(true);
    const { getByTestId, rerender, wrap } = renderTransactionsScreen('en');

    await waitFor(() => {
      expect(getByTestId('transactions-screen')).toBeTruthy();
    });

    // Switch to Pending filter
    fireEvent.press(getByTestId('filter-chip-pending'));

    // Open quick complete modal
    fireEvent.press(getByTestId('quick-complete-tx-3'));
    expect(getByTestId('complete-pending-modal')).toBeTruthy();

    const writeRequestsBefore = mockServer.getWriteRequests().length;

    // Drop offline coherently across native and TanStack onlineManager
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
    setNetworkOnline(false);
    rerender(wrap(<TransactionsScreen />));

    expect(getByTestId('complete-modal-offline-warning')).toBeTruthy();

    // Press confirm while offline and flush all pending microtasks inside act
    await act(async () => {
      fireEvent.press(getByTestId('complete-modal-confirm'));
      await Promise.resolve();
    });

    // Concretely verify NO HTTP write was executed
    expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);

    // Reconnect online: verify no paused/queued mutation fires upon reconnection
    await act(async () => {
      setNetworkOnline(true);
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
      await Promise.resolve();
    });

    expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
  });
});
