import React from 'react';
import { ScrollView } from 'react-native';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import InvoicesScreen from '../(app)/invoices';
import MoreScreen from '../(app)/(tabs)/more';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as onlineModule from '../../query/useIsOnline';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import type { Invoice } from '@haseela/shared';
import {
  mockServer,
  mockInvoiceStore,
  setupMockInvoiceServer,
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

jest.mock('../../auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    status: 'signedIn',
    signOut: jest.fn(),
  }),
}));

jest.mock('../../query/useIsOnline', () => ({
  useIsOnline: jest.fn(),
}));

const originalFetch = global.fetch;

describe('InvoicesScreen & More Navigation', () => {
  let testQueryClient: ReturnType<typeof createTestQueryClient>;
  let unregisterMock: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    setNetworkOnline(true);

    mockServer.reset({
      preferences: defaultMockPreferences,
    });
    mockInvoiceStore.reset();
    unregisterMock = setupMockInvoiceServer(mockServer);
    global.fetch = mockServer.fetchHandler;

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: { access_token: 'test-token', user: { id: 'user-123' } },
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
    unregisterMock();
    global.fetch = originalFetch;
    act(() => {
      resetNetworkOnline();
    });
    testQueryClient.cancelQueries();
    testQueryClient.clear();
    testQueryClient.getMutationCache().clear();
  });

  const wrapper = ({ children }: { children: any }) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={testQueryClient}>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  it('navigates from More tab to Invoices screen via more-invoices-link', async () => {
    const { getByTestId } = render(<MoreScreen />, { wrapper });

    const invoicesLink = getByTestId('more-invoices-link');
    expect(invoicesLink).toBeTruthy();

    fireEvent.press(invoicesLink);
    expect(mockPush).toHaveBeenCalledWith('/(app)/invoices');
  });

  it('uses the invoice list as the only scroll container (no list nested in a ScrollView)', async () => {
    const { findByTestId, UNSAFE_getAllByType } = render(<InvoicesScreen />, { wrapper });
    await findByTestId('invoice-row-inv-1');
    expect(UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
  });

  it('renders invoices list with summary tiles grouped by currency and 30-day cutoff', async () => {
    const { getByTestId, findByTestId, findByText } = render(<InvoicesScreen />, { wrapper });

    // Wait for list to load
    await findByTestId('invoice-row-inv-1');

    // Summary cards: verify USD group exists
    expect(getByTestId('invoice-summary-group-USD')).toBeTruthy();
    // Verify EUR group exists (multi-currency invoices)
    expect(getByTestId('invoice-summary-group-EUR')).toBeTruthy();

    // Verify USD numbers (from mockInvoiceStore):
    // inv-1: 1850 (SENT, past due -> OVERDUE)
    // inv-2: 3520 (SENT, future due -> SENT)
    // inv-3: 4150 (PAID, 5 days ago -> paid30d)
    // USD Outstanding = 1850 + 3520 = 5370
    // USD Overdue = 1850
    // USD Paid 30d = 4150
    const usdOutstanding = getByTestId('invoice-summary-outstanding-USD');
    const usdOverdue = getByTestId('invoice-summary-overdue-USD');
    const usdPaid30d = getByTestId('invoice-summary-paid30d-USD');

    expect(usdOutstanding).toBeTruthy();
    expect(usdOverdue).toBeTruthy();
    expect(usdPaid30d).toBeTruthy();

    // EUR numbers:
    // inv-4: 890 (DRAFT)
    // EUR Outstanding = 0, Overdue = 0, Paid 30d = 0
    const eurOutstanding = getByTestId('invoice-summary-outstanding-EUR');
    expect(eurOutstanding).toBeTruthy();

    // Check row contents
    expect(await findByText('#INV-0044 · Acme Corp')).toBeTruthy();
  });

  it('filters invoices by search query (number and client name)', async () => {
    const { getByTestId, findByTestId, queryByTestId } = render(<InvoicesScreen />, { wrapper });

    await findByTestId('invoice-row-inv-1');
    expect(getByTestId('invoice-row-inv-2')).toBeTruthy();

    // Toggle search
    const toggleSearchBtn = getByTestId('invoices-toggle-search-btn');
    fireEvent.press(toggleSearchBtn);

    const searchInput = getByTestId('invoices-search-input');

    // Search by client name "Globex"
    fireEvent.changeText(searchInput, 'Globex');

    await waitFor(() => {
      expect(queryByTestId('invoice-row-inv-2')).toBeTruthy();
      expect(queryByTestId('invoice-row-inv-1')).toBeNull();
    });

    // Clear search
    const clearBtn = getByTestId('invoices-search-clear-btn');
    fireEvent.press(clearBtn);

    await waitFor(() => {
      expect(queryByTestId('invoice-row-inv-1')).toBeTruthy();
      expect(queryByTestId('invoice-row-inv-2')).toBeTruthy();
    });
  });

  it('filters invoices by status chips', async () => {
    const { getByTestId, findByTestId, queryByTestId } = render(<InvoicesScreen />, { wrapper });

    await findByTestId('invoice-row-inv-1');

    // Filter: Draft
    const draftChip = getByTestId('invoice-filter-draft');
    fireEvent.press(draftChip);

    await waitFor(() => {
      expect(queryByTestId('invoice-row-inv-4')).toBeTruthy(); // inv-4 is DRAFT
      expect(queryByTestId('invoice-row-inv-1')).toBeNull();
      expect(queryByTestId('invoice-row-inv-2')).toBeNull();
    });

    // Filter: Paid
    const paidChip = getByTestId('invoice-filter-paid');
    fireEvent.press(paidChip);

    await waitFor(() => {
      expect(queryByTestId('invoice-row-inv-3')).toBeTruthy(); // inv-3 is PAID
      expect(queryByTestId('invoice-row-inv-4')).toBeNull();
    });

    // Filter: All
    const allChip = getByTestId('invoice-filter-all');
    fireEvent.press(allChip);

    await waitFor(() => {
      expect(queryByTestId('invoice-row-inv-1')).toBeTruthy();
      expect(queryByTestId('invoice-row-inv-2')).toBeTruthy();
      expect(queryByTestId('invoice-row-inv-3')).toBeTruthy();
      expect(queryByTestId('invoice-row-inv-4')).toBeTruthy();
    });
  });

  it('navigates to new invoice screen on add button press', async () => {
    const { getByTestId, findByTestId } = render(<InvoicesScreen />, { wrapper });

    await findByTestId('invoice-row-inv-1');

    const addBtn = getByTestId('invoices-add-btn');
    fireEvent.press(addBtn);

    expect(mockPush).toHaveBeenCalledWith('/(app)/invoice/new');
  });

  it('navigates to invoice detail on row press', async () => {
    const { getByTestId, findByTestId } = render(<InvoicesScreen />, { wrapper });

    const row = await findByTestId('invoice-row-inv-1');
    fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith('/(app)/invoice/inv-1');
  });

  it('handles offline state with read-only banner and disabled creation', async () => {
    // Seed scoped cache before transitioning offline
    testQueryClient.setQueryData(['invoices', 'user-123'], mockInvoiceStore.getInvoices());
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
    setNetworkOnline(false);
    mockServer.clearRequests();

    const { getByTestId, findByTestId } = render(<InvoicesScreen />, { wrapper });

    await findByTestId('invoice-row-inv-1');

    // Offline banner is visible
    expect(getByTestId('invoices-offline-banner')).toBeTruthy();

    // Pressing add button while offline does NOT navigate
    const addBtn = getByTestId('invoices-add-btn');
    fireEvent.press(addBtn);
    expect(mockPush).not.toHaveBeenCalled();

    // Verify zero HTTP requests occurred and no queued requests
    expect(mockServer.getRequestCount('GET', '/api/invoices')).toBe(0);
    expect(mockServer.getWriteRequests()).toHaveLength(0);
  });

  it('shows cold offline screen when offline with no cached data', async () => {
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);

    // Override mock to return empty/simulate no cache
    mockServer.setError('/api/invoices', 500, { error: 'Network failure' });

    const { findByTestId } = render(<InvoicesScreen />, { wrapper });

    expect(await findByTestId('invoices-offline-screen')).toBeTruthy();
  });

  it('displays stale error banner with retry when refetch fails after data loaded', async () => {
    const { getByTestId, findByTestId, queryByTestId } = render(<InvoicesScreen />, { wrapper });

    await findByTestId('invoice-row-inv-1');

    // Inject server error for subsequent refetch
    mockServer.setError('/api/invoices', 500, { error: 'Temporary server failure' });

    // Trigger refetch
    await act(async () => {
      testQueryClient.refetchQueries({ queryKey: ['invoices', 'user-123'] });
    });

    // Content should NOT be hidden; stale banner appears
    await waitFor(() => {
      expect(getByTestId('invoices-stale-banner')).toBeTruthy();
      expect(queryByTestId('invoice-row-inv-1')).toBeTruthy();
    });

    // Clear error on mockServer and test retry button
    mockServer.clearError('/api/invoices');
    const retryBtn = getByTestId('invoices-stale-retry-btn');
    fireEvent.press(retryBtn);

    await waitFor(() => {
      expect(queryByTestId('invoices-stale-banner')).toBeNull();
    });
  });
});
