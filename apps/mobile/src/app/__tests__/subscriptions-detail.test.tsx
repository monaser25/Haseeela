import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewSubscriptionScreen from '../(app)/subscription/new';
import SubscriptionDetailScreen from '../(app)/subscription/[id]';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import * as onlineModule from '../../query/useIsOnline';
import type { Subscription, Transaction } from '@haseela/shared';
import {
  mockServer,
  createTestQueryClient,
  setNetworkOnline,
  resetNetworkOnline,
  defaultMockPreferences,
} from '../../test';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockLocalSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => mockLocalSearchParams,
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

const sampleSubscriptions: Subscription[] = [
  {
    id: 'sub-active-1',
    name: 'Figma Professional',
    amount: 15,
    cycle: 'MONTHLY',
    billingCycle: 'MONTHLY',
    billingDay: 5,
    nextBillingDate: '2026-04-05',
    status: 'ACTIVE',
    notes: 'Design team seat',
  },
  {
    id: 'sub-yearly-1',
    name: 'GitHub Copilot',
    amount: 100,
    cycle: 'YEARLY',
    billingCycle: 'YEARLY',
    billingDay: 1,
    nextBillingDate: '2027-01-01',
    status: 'ACTIVE',
  },
  {
    id: 'sub-archived-1',
    name: 'Legacy Hosting',
    amount: 25,
    cycle: 'MONTHLY',
    billingCycle: 'MONTHLY',
    billingDay: 10,
    nextBillingDate: '2026-03-10',
    status: 'INACTIVE',
    archivedAt: '2026-02-15T00:00:00.000Z',
    notes: 'Deprecated server',
  },
];

const sampleTransactions: Transaction[] = [
  {
    id: 'tx-sub-1',
    name: 'Figma Professional subscription payment',
    amount: 15,
    type: 'EXPENSE',
    status: 'COMPLETED',
    date: '2026-03-05',
    sourceType: 'subscription',
    sourceId: 'sub-active-1',
    subscriptionId: 'sub-active-1',
    categoryId: 'TOOLS',
  },
  {
    id: 'tx-sub-archived-1',
    name: 'Legacy Hosting subscription payment',
    amount: 25,
    type: 'EXPENSE',
    status: 'COMPLETED',
    date: '2026-02-10',
    sourceType: 'subscription',
    sourceId: 'sub-archived-1',
    subscriptionId: 'sub-archived-1',
    categoryId: 'TOOLS',
  },
];

describe('Subscriptions Detail & Add Flows', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    act(() => {
      setNetworkOnline(true);
    });
    mockLocalSearchParams = {};

    mockServer.reset({
      subscriptions: sampleSubscriptions,
      transactions: sampleTransactions,
      preferences: defaultMockPreferences,
    });
    global.fetch = mockServer.fetchHandler;

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: { access_token: 'mock-test-access-token', user: { id: 'test-user-id' } },
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
    act(() => {
      resetNetworkOnline();
    });
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

  function renderWithProviders(
    node: React.ReactElement,
    initialLocale: 'en' | 'ar' = 'en',
    themePreference: 'light' | 'dark' = 'light'
  ) {
    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={testQueryClient}>
          <ThemeProvider initialPreference={themePreference}>
            <I18nProvider initialLocale={initialLocale}>{node}</I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  // ===================== NEW SUBSCRIPTION SCREEN =====================
  describe('NewSubscriptionScreen', () => {
    it('renders all form fields with initial defaults', () => {
      const { getByTestId } = renderWithProviders(<NewSubscriptionScreen />);

      expect(getByTestId('subscription-new-screen')).toBeTruthy();
      expect(getByTestId('subscription-name-input')).toBeTruthy();
      expect(getByTestId('subscription-amount-input')).toBeTruthy();
      expect(getByTestId('subscription-cycle-monthly')).toBeTruthy();
      expect(getByTestId('subscription-cycle-quarterly')).toBeTruthy();
      expect(getByTestId('subscription-cycle-yearly')).toBeTruthy();
      expect(getByTestId('subscription-billing-day-input')).toBeTruthy();
      expect(getByTestId('subscription-next-billing-date-picker')).toBeTruthy();
      expect(getByTestId('subscription-status-active')).toBeTruthy();
      expect(getByTestId('subscription-status-inactive')).toBeTruthy();
      expect(getByTestId('subscription-notes-input')).toBeTruthy();
      expect(getByTestId('subscription-save-button')).toBeTruthy();
      expect(getByTestId('subscription-cancel-button')).toBeTruthy();
    });

    it('rejects empty name with localized validation error and prevents write', async () => {
      const { getByTestId, findByText } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-amount-input'), '20');
      fireEvent.press(getByTestId('subscription-save-button'));

      expect(await findByText('Subscription name is required.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/subscriptions/create')).toBe(0);
    });

    test.each([
      ['standard decimal dot', '15.50', 15.5],
      ['Arabic-Indic digits', '١٥٫٥٠', 15.5],
      ['decimal comma', '15,50', 15.5],
      ['Persian digits', '۱۵.۵۰', 15.5],
    ])('handles localized amount parsing: %s (%s -> %s)', async (_, inputStr, expectedNum) => {
      const { getByTestId } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-name-input'), 'Linear Pro');
      fireEvent.changeText(getByTestId('subscription-amount-input'), inputStr);
      fireEvent.press(getByTestId('subscription-save-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const req = mockServer.getRequests().find((r) => r.path === '/api/subscriptions/create');
      expect(req).toBeTruthy();
      expect(req?.body.amount).toBe(expectedNum);
    });

    test.each([
      ['blank amount', ''],
      ['zero amount', '0'],
      ['negative amount', '-15'],
      ['malformed letters', 'abc'],
      ['multiple separators', '1,2,3'],
    ])('rejects invalid/zero/negative amount %s', async (_, invalidInput) => {
      const { getByTestId, findByText } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-name-input'), 'Invalid Test');
      fireEvent.changeText(getByTestId('subscription-amount-input'), invalidInput);
      fireEvent.press(getByTestId('subscription-save-button'));

      expect(
        await findByText('Please enter a valid amount greater than zero.')
      ).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/subscriptions/create')).toBe(0);
    });

    test.each([
      ['below range', '0'],
      ['above range', '29'],
      ['letters appended', '12abc'],
      ['decimal point', '12.5'],
      ['blank day', '   '],
    ])('rejects invalid billing day %s', async (_, invalidDay) => {
      const { getByTestId, findByText } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-name-input'), 'Day Test');
      fireEvent.changeText(getByTestId('subscription-amount-input'), '10');
      fireEvent.changeText(getByTestId('subscription-billing-day-input'), invalidDay);
      fireEvent.press(getByTestId('subscription-save-button'));

      expect(
        await findByText('Billing day must be a whole number between 1 and 28.')
      ).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/subscriptions/create')).toBe(0);
    });

    it('creates a subscription with localized Arabic billing day', async () => {
      const { getByTestId } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-name-input'), 'Notion Plus');
      fireEvent.changeText(getByTestId('subscription-amount-input'), '10');
      fireEvent.changeText(getByTestId('subscription-billing-day-input'), '١٥');
      fireEvent.press(getByTestId('subscription-cycle-yearly'));

      fireEvent.press(getByTestId('subscription-save-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const req = mockServer.getRequests().find((r) => r.path === '/api/subscriptions/create');
      expect(req).toBeTruthy();
      expect(req?.body.name).toBe('Notion Plus');
      expect(req?.body.amount).toBe(10);
      expect(req?.body.cycle).toBe('YEARLY');
      expect(req?.body.billingDay).toBe(15);
    });

    it('retains user inputs when backend fails on create', async () => {
      mockServer.setError('/api/subscriptions/create', 500, {
        message: 'Database save failed',
      });

      const { getByTestId, findByText } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-name-input'), 'Failing Tool');
      fireEvent.changeText(getByTestId('subscription-amount-input'), '49.99');
      fireEvent.changeText(getByTestId('subscription-notes-input'), 'Keep my notes');

      fireEvent.press(getByTestId('subscription-save-button'));

      expect(await findByText('Database save failed')).toBeTruthy();

      // Inputs must be retained!
      expect(getByTestId('subscription-name-input').props.value).toBe('Failing Tool');
      expect(getByTestId('subscription-amount-input').props.value).toBe('49.99');
      expect(getByTestId('subscription-notes-input').props.value).toBe('Keep my notes');
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  // ===================== SUBSCRIPTION DETAIL SCREEN =====================
  describe('SubscriptionDetailScreen', () => {
    it('renders detail overview, badges, and linked transaction history', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      const { findByTestId, getByTestId, getByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      expect(getByTestId('subscription-detail-amount')).toBeTruthy();
      expect(getByTestId('subscription-detail-next-date')).toBeTruthy();
      expect(getByTestId('subscription-detail-billing-day')).toBeTruthy();
      expect(getByTestId('subscription-detail-notes')).toBeTruthy();
      expect(getByText('Design team seat')).toBeTruthy();

      // Check linked transaction history displays tx-sub-1
      expect(getByTestId('subscription-tx-tx-sub-1')).toBeTruthy();
      expect(getByText('Figma Professional subscription payment')).toBeTruthy();
    });

    it('renders Arabic labels and localized history without leaking raw enums in Arabic locale', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      const { findByTestId, getByText, queryByText } = renderWithProviders(
        <SubscriptionDetailScreen />,
        'ar'
      );

      await findByTestId('subscription-detail-screen');

      // Arabic labels
      expect(getByText('شهري')).toBeTruthy(); // MONTHLY in Arabic
      expect(getByText('نشط')).toBeTruthy(); // ACTIVE in Arabic
      expect(getByText('سجل المدفوعات')).toBeTruthy();

      // Localized transaction name suffix in history
      expect(getByText(/دفعة اشتراك/)).toBeTruthy();

      // Never leak English raw enums
      expect(queryByText('MONTHLY')).toBeNull();
      expect(queryByText('ACTIVE')).toBeNull();
    });

    it('preserves unsaved edit inputs across background refetches while editing', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // Enter edit mode
      fireEvent.press(getByTestId('subscription-edit-button'));

      const nameInput = getByTestId('subscription-edit-name-input');
      fireEvent.changeText(nameInput, 'Unsaved Draft Name');
      expect(nameInput.props.value).toBe('Unsaved Draft Name');

      // Trigger background overview refetch
      await act(async () => {
        await testQueryClient.refetchQueries({ queryKey: ['overview', 'user-123'] });
      });

      // Assert unsaved input was NOT wiped out by background refetch
      expect(getByTestId('subscription-edit-name-input').props.value).toBe('Unsaved Draft Name');
    });

    it('cancelling edit discards draft and next edit entry initializes fresh from latest subscription', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // Enter edit mode
      fireEvent.press(getByTestId('subscription-edit-button'));
      fireEvent.changeText(getByTestId('subscription-edit-name-input'), 'Discarded Draft Name');

      // Cancel edit
      fireEvent.press(getByTestId('subscription-cancel-edit-button'));
      expect(queryByTestId('subscription-edit-name-input')).toBeNull();

      // Re-enter edit mode: must initialize with original subscription name!
      fireEvent.press(getByTestId('subscription-edit-button'));
      expect(getByTestId('subscription-edit-name-input').props.value).toBe('Figma Professional');
    });

    it('edits a subscription, invalidates overview, and visibly updates detail screen', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      const { findByTestId, getByTestId, findByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      fireEvent.press(getByTestId('subscription-edit-button'));

      fireEvent.changeText(getByTestId('subscription-edit-amount-input'), '25');
      fireEvent.press(getByTestId('subscription-edit-cycle-quarterly'));
      fireEvent.press(getByTestId('subscription-save-button'));

      // Visible updated feedback
      expect(await findByText('Subscription updated')).toBeTruthy();

      // Overview reflected
      await waitFor(() => {
        expect(getByTestId('subscription-detail-amount').props.children).toContain('25.00');
      });
    });

    it('honestly blocks clearing existing notes with localized validation error', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' }; // Has notes: 'Design team seat'

      const { findByTestId, getByTestId, findByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      fireEvent.press(getByTestId('subscription-edit-button'));

      // Clear the notes field
      fireEvent.changeText(getByTestId('subscription-edit-notes-input'), '');
      fireEvent.press(getByTestId('subscription-save-button'));

      expect(
        await findByText(
          'Clearing notes is not supported. Please keep or edit the note.'
        )
      ).toBeTruthy();

      // Zero update requests dispatched
      expect(
        mockServer.getRequestCount('PUT', '/api/subscriptions/update/sub-active-1')
      ).toBe(0);
    });

    it('regression: recording payment advances schedule, and subsequent edit preserves advanced date', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' }; // initial date: 2026-04-05, cycle: MONTHLY

      const { findByTestId, getByTestId, getByText, findByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // 1. Record payment
      fireEvent.press(getByTestId('subscription-record-payment-btn'));
      expect(await findByTestId('record-subscription-payment-modal')).toBeTruthy();
      expect(getByText(/Scheduled billing date:/)).toBeTruthy();

      fireEvent.press(getByTestId('subscription-record-payment-confirm'));

      // Visible feedback
      expect(await findByText('Payment recorded')).toBeTruthy();

      // Next billing date is visibly advanced to May 2026
      await waitFor(() => {
        expect(getByTestId('subscription-detail-next-date').props.children).toMatch(/^May/);
      });

      // 2. Open edit mode and change only the name
      fireEvent.press(getByTestId('subscription-edit-button'));
      const editNextDate = getByTestId('subscription-edit-next-billing-date-picker');
      expect(editNextDate).toBeTruthy();

      fireEvent.changeText(getByTestId('subscription-edit-name-input'), 'Figma Enterprise');
      fireEvent.press(getByTestId('subscription-save-button'));

      await waitFor(() => {
        expect(
          mockServer.getRequests().some((r) => r.method === 'PUT' && r.path.includes('/api/subscriptions/update/sub-active-1'))
        ).toBe(true);
      });

      // Assert PUT preserved the advanced date (2026-05-05) instead of rolling back to 2026-04-05!
      const putReq = mockServer.getRequests().find((r) => r.path === '/api/subscriptions/update/sub-active-1');
      expect(putReq?.body.nextBillingDate).toBe('2026-05-05');
    });

    test.each([
      ['MONTHLY', 'sub-active-1', /^May/],
      ['YEARLY', 'sub-yearly-1', /^Jan.*2028/],
    ])('records payment for %s cycle through UI and visibly advances date', async (_, subId, expectedDatePattern) => {
      mockLocalSearchParams = { id: subId };

      const { findByTestId, getByTestId, findByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      fireEvent.press(getByTestId('subscription-record-payment-btn'));
      fireEvent.press(getByTestId('subscription-record-payment-confirm'));

      expect(await findByText('Payment recorded')).toBeTruthy();

      await waitFor(() => {
        expect(getByTestId('subscription-detail-next-date').props.children).toMatch(expectedDatePattern);
      });
    });

    it('payment hook upserts by id and prevents double counting when server dedupes (overview refetch deferred/failed)', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      // Seed an existing transaction with the same id and source billing date
      const existingTx: Transaction = {
        id: 'auto-subscription-sub-active-1-2026-04-05',
        name: 'Figma Professional subscription payment',
        amount: 15,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: '2026-04-05',
        sourceType: 'subscription',
        sourceId: 'sub-active-1',
        sourceBillingDate: '2026-04-05',
        categoryId: 'TOOLS',
        subscriptionId: 'sub-active-1',
      };
      mockServer.getState().transactions.push(existingTx);

      const { findByTestId, getByTestId, findByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // Now set overview error so the post-payment refetch fails / cannot mask the setQueryData upsert
      mockServer.setError('/api/dashboard/overview', 500, { message: 'Overview refetch deferred/failed' });

      // Record payment: server returns deduplicated existingTx with id 'auto-subscription-sub-active-1-2026-04-05'
      fireEvent.press(getByTestId('subscription-record-payment-btn'));
      fireEvent.press(getByTestId('subscription-record-payment-confirm'));

      expect(await findByText('Payment recorded')).toBeTruthy();

      // Check query cache: transactions must have exactly ONE entry for this id, NOT duplicated!
      const cachedOverview = testQueryClient.getQueryData<any>(['overview', 'user-123']);
      const matchingTxs = cachedOverview.transactions.filter(
        (t: any) => t.id === 'auto-subscription-sub-active-1-2026-04-05'
      );
      expect(matchingTxs.length).toBe(1);
    });

    it('handles cached overview without id while offline without crashing', async () => {
      mockLocalSearchParams = { id: 'non-existent-sub-id' };

      // Cache has subscriptions, but not this id, and device is offline
      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
        setNetworkOnline(false);
      });

      const { findByTestId, queryByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      // Renders offline screen cleanly without crashing!
      await findByTestId('subscription-detail-offline');
      expect(queryByTestId('subscription-not-found')).toBeNull();
    });

    it('handles valid detail -> permanent delete -> deferred post-delete overview without crashing', async () => {
      mockLocalSearchParams = { id: 'sub-archived-1' };

      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // Defer post-delete overview query so it stays in isFetching state
      mockServer.setPending('/api/dashboard/overview');

      fireEvent.press(getByTestId('subscription-delete-permanent-btn'));
      expect(await findByTestId('permanent-delete-subscription-modal')).toBeTruthy();

      // Confirm delete: delete hook sets query data (removing subscription) and invalidates queries
      fireEvent.press(getByTestId('subscription-permanent-delete-confirm'));

      // While overview is pending refetch, screen renders loading skeleton and does NOT crash!
      expect(await findByTestId('subscription-detail-loading')).toBeTruthy();

      // Resolve pending overview so mutation settles
      await act(async () => {
        mockServer.resolvePending('/api/dashboard/overview');
      });

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it('handles initial missing id during deferred background refetch without crashing', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };
      mockServer.setPending('/api/dashboard/overview');

      const { findByTestId, queryByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      // While initial overview is pending, renders loading skeleton without null crash
      await findByTestId('subscription-detail-loading');
      expect(queryByTestId('subscription-detail-screen')).toBeNull();

      await act(async () => {
        mockServer.resolvePending('/api/dashboard/overview');
      });

      await findByTestId('subscription-detail-screen');
    });

    it('blocks conflicting or duplicate presses while mutation is pending with zero extra writes', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };
      mockServer.setPending('/api/subscriptions/update/sub-active-1');

      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      fireEvent.press(getByTestId('subscription-edit-button'));

      // Change amount
      fireEvent.changeText(getByTestId('subscription-edit-amount-input'), '50');

      const saveBtn = getByTestId('subscription-save-button');

      // First press triggers mutation
      fireEvent.press(saveBtn);
      await waitFor(() => {
        expect(mockServer.getRequestCount('PUT', '/api/subscriptions/update/sub-active-1')).toBe(1);
      });

      // Attempt duplicate press while pending
      fireEvent.press(saveBtn);
      // Still only 1 request dispatched
      expect(mockServer.getRequestCount('PUT', '/api/subscriptions/update/sub-active-1')).toBe(1);

      // Resolve pending
      await act(async () => {
        mockServer.resolvePending('/api/subscriptions/update/sub-active-1', {
          ...sampleSubscriptions[0],
          amount: 50,
        });
      });
    });

    it('archives a subscription and stops future billing', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      fireEvent.press(getByTestId('subscription-archive-btn'));

      expect(await findByTestId('archive-subscription-modal')).toBeTruthy();

      fireEvent.press(getByTestId('subscription-archive-confirm'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const sub = mockServer.getState().subscriptions.find((s) => s.id === 'sub-active-1');
      expect(sub?.status).toBe('INACTIVE');
      expect(sub?.archivedAt).toBeTruthy();

      // Past transactions are retained!
      const pastTx = mockServer.getState().transactions.find((t) => t.subscriptionId === 'sub-active-1');
      expect(pastTx).toBeTruthy();
    });

    it('restores an archived subscription back to ACTIVE and preserves ACTIVE when entering edit', async () => {
      mockLocalSearchParams = { id: 'sub-archived-1' };

      const { findByTestId, getByTestId, findByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      fireEvent.press(getByTestId('subscription-restore-btn'));

      // Visible feedback
      expect(await findByText('Subscription restored')).toBeTruthy();

      const sub = mockServer.getState().subscriptions.find((s) => s.id === 'sub-archived-1');
      expect(sub?.status).toBe('ACTIVE');
      expect(sub?.archivedAt).toBeUndefined();

      // Now enter edit mode: must show status ACTIVE
      fireEvent.press(getByTestId('subscription-edit-button'));
      const activeBtn = getByTestId('subscription-edit-status-active');
      expect(activeBtn.props.accessibilityState.selected).toBe(true);
    });

    it('asserts permanent delete warning in English & Arabic does NOT contain retention copy and deletes transactions', async () => {
      mockLocalSearchParams = { id: 'sub-archived-1' };

      // 1. English check
      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />,
        'en'
      );

      await findByTestId('subscription-detail-screen');
      fireEvent.press(getByTestId('subscription-delete-permanent-btn'));

      const modal = await findByTestId('permanent-delete-subscription-modal');
      expect(modal).toBeTruthy();

      const warningText = getByTestId('subscription-permanent-delete-warning').props.children;
      // Must contain unambiguous deletion warning
      expect(warningText).toContain(
        'This will permanently delete this subscription and remove all linked transaction history from your records. This cannot be undone.'
      );
      // Must NOT contain archive-retention copy
      expect(warningText).not.toContain('will stay in your transaction history');
      expect(warningText).not.toContain('stay in analytics');

      // Confirm permanent delete
      fireEvent.press(getByTestId('subscription-permanent-delete-confirm'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      // Subscription deleted from server state
      expect(
        mockServer.getState().subscriptions.some((s) => s.id === 'sub-archived-1')
      ).toBe(false);

      // Linked transactions atomically deleted from history
      expect(
        mockServer.getState().transactions.some((t) => t.subscriptionId === 'sub-archived-1')
      ).toBe(false);
    });

    it('asserts permanent delete warning in Arabic does NOT contain retention copy', async () => {
      mockLocalSearchParams = { id: 'sub-archived-1' };

      // 2. Arabic check
      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />,
        'ar'
      );

      await findByTestId('subscription-detail-screen');
      fireEvent.press(getByTestId('subscription-delete-permanent-btn'));

      const modal = await findByTestId('permanent-delete-subscription-modal');
      expect(modal).toBeTruthy();

      const warningText = getByTestId('subscription-permanent-delete-warning').props.children;
      // Must contain Arabic deletion warning
      expect(warningText).toContain(
        'سيؤدي هذا إلى حذف الاشتراك نهائياً وإزالة جميع المعاملات المرتبطة به من السجل. لا يمكن التراجع عن هذا الإجراء.'
      );
      // Must NOT contain retention copy
      expect(warningText).not.toContain('ستظل في سجلك');
    });

    it('modal error lifecycle: failure error is cleared on modal cancel and reopen', async () => {
      mockLocalSearchParams = { id: 'sub-active-1' };

      // Simulate payment failure
      mockServer.setError('/record-payment', 500, { message: 'Card declined by provider' });

      const { findByTestId, getByTestId, findByText, queryByText } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // Open payment modal
      fireEvent.press(getByTestId('subscription-record-payment-btn'));
      expect(await findByTestId('record-subscription-payment-modal')).toBeTruthy();

      // Confirm payment -> fails
      fireEvent.press(getByTestId('subscription-record-payment-confirm'));
      expect(await findByText('Card declined by provider')).toBeTruthy();

      // Cancel modal
      fireEvent.press(getByTestId('subscription-record-payment-cancel'));

      // Clear mock error for next try
      mockServer.clearError('/record-payment');

      // Reopen modal -> obsolete error must NOT be present!
      fireEvent.press(getByTestId('subscription-record-payment-btn'));
      expect(await findByTestId('record-subscription-payment-modal')).toBeTruthy();
      expect(queryByText('Card declined by provider')).toBeNull();
    });

    it('renders cold offline screen when detail is accessed offline without cache', async () => {
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
      setNetworkOnline(false);

      mockLocalSearchParams = { id: 'sub-active-1' };
      mockServer.reset({ subscriptions: [] }); // empty cache

      const { findByTestId, getByText, queryByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-offline');
      expect(
        getByText(/needs a connection to load your latest clients, subscriptions/)
      ).toBeTruthy();

      // Does NOT fall through to "not found"!
      expect(queryByTestId('subscription-not-found')).toBeNull();
    });

    test.each([
      ['edit save', 'subscription-edit-button', 'subscription-save-button', 'PUT', '/api/subscriptions/update'],
      ['record payment', 'subscription-record-payment-btn', 'subscription-record-payment-confirm', 'POST', '/record-payment'],
      ['archive', 'subscription-archive-btn', 'subscription-archive-confirm', 'DELETE', '/api/subscriptions/delete/'],
      ['permanent delete', 'subscription-delete-permanent-btn', 'subscription-permanent-delete-confirm', 'DELETE', '/api/subscriptions/delete-permanent/'],
    ])('offline transition blocks %s with zero queued writes after reconnect', async (
      _,
      openTriggerId,
      confirmBtnId,
      method,
      pathSnippet
    ) => {
      mockLocalSearchParams = { id: pathSnippet.includes('delete-permanent') ? 'sub-archived-1' : 'sub-active-1' };

      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');
      fireEvent.press(getByTestId(openTriggerId));

      // Network drops while modal / editor is open
      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
        setNetworkOnline(false);
      });

      // Attempt to confirm write while offline
      const confirmBtn = getByTestId(confirmBtnId);
      fireEvent.press(confirmBtn);

      // Assert zero writes dispatched and zero mutations in pending or paused state
      expect(mockServer.getRequestCount(method, pathSnippet)).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.status === 'pending' || m.state.isPaused).length
      ).toBe(0);

      // Reconnect network
      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        setNetworkOnline(true);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      // Still zero writes and zero paused mutations
      expect(mockServer.getRequestCount(method, pathSnippet)).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.isPaused).length
      ).toBe(0);
    });

    it('offline transition blocks NewSubscriptionScreen save with zero queued writes after reconnect', async () => {
      const { getByTestId } = renderWithProviders(<NewSubscriptionScreen />);

      fireEvent.changeText(getByTestId('subscription-name-input'), 'Offline New Sub');
      fireEvent.changeText(getByTestId('subscription-amount-input'), '30');

      // Network drops while form is open
      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
        setNetworkOnline(false);
      });

      fireEvent.press(getByTestId('subscription-save-button'));

      expect(mockServer.getRequestCount('POST', '/api/subscriptions/create')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.status === 'pending' || m.state.isPaused).length
      ).toBe(0);

      // Reconnect network
      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        setNetworkOnline(true);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      expect(mockServer.getRequestCount('POST', '/api/subscriptions/create')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.isPaused).length
      ).toBe(0);
    });

    it('offline transition blocks restore with zero queued writes after reconnect', async () => {
      mockLocalSearchParams = { id: 'sub-archived-1' };

      const { findByTestId, getByTestId } = renderWithProviders(
        <SubscriptionDetailScreen />
      );

      await findByTestId('subscription-detail-screen');

      // Network drops
      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
        setNetworkOnline(false);
      });

      fireEvent.press(getByTestId('subscription-restore-btn'));

      expect(mockServer.getRequestCount('PATCH', '/api/subscriptions/restore/sub-archived-1')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.status === 'pending' || m.state.isPaused).length
      ).toBe(0);

      act(() => {
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        setNetworkOnline(true);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      expect(mockServer.getRequestCount('PATCH', '/api/subscriptions/restore/sub-archived-1')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.isPaused).length
      ).toBe(0);
    });
  });
});
