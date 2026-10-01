import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewClientScreen from '../(app)/client/new';
import ClientDetailScreen from '../(app)/client/[id]';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import type { Client, Transaction } from '@haseela/shared';
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

const originalFetch = global.fetch;

const sampleClients: Client[] = [
  {
    id: 'client-retainer-1',
    name: 'Atlas Creative',
    company: 'Atlas Media Group',
    email: 'hello@atlascreative.com',
    revenue: 4000,
    clientType: 'COMPANY',
    status: 'ACTIVE',
    paymentType: 'retainer',
    billingDay: 15,
    nextBillingDate: '2026-04-15',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'client-onetime-1',
    name: 'Sarah Connor',
    revenue: 1500,
    clientType: 'INDIVIDUAL',
    status: 'ACTIVE',
    paymentType: 'onetime',
    paymentDate: '2026-03-20',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'client-archived-1',
    name: 'Inactive Old Co',
    company: 'Old Corp',
    email: 'old@example.com',
    revenue: 800,
    clientType: 'COMPANY',
    status: 'INACTIVE',
    paymentType: 'onetime',
    archivedAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2025-11-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
];

const sampleTransactions: Transaction[] = [
  {
    id: 'tx-1',
    name: 'Atlas March Retainer',
    amount: 4000,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2026-03-15',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-retainer-1',
  },
  {
    id: 'tx-2',
    name: 'Sarah Connor Photoshoot',
    amount: 1500,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2026-03-20',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-onetime-1',
  },
  {
    id: 'tx-archived-1',
    name: 'Old Co Initial Setup',
    amount: 800,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2025-11-05',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-archived-1',
  },
];

describe('Client Detail & New Client Screens', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      setNetworkOnline(true);
    });
    mockLocalSearchParams = {};

    mockServer.reset({
      clients: sampleClients,
      transactions: sampleTransactions,
      preferences: defaultMockPreferences,
    });
    global.fetch = mockServer.fetchHandler;

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: { access_token: 'mock-test-access-token' },
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

  function renderWithProviders(
    node: React.ReactElement,
    initialLocale: 'en' | 'ar' = 'en',
    themePreference: 'light' | 'dark' = 'light'
  ) {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={testQueryClient}>
          <ThemeProvider initialPreference={themePreference}>
            <I18nProvider initialLocale={initialLocale}>
              {node}
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  // ===================== NEW CLIENT SCREEN =====================
  describe('NewClientScreen', () => {
    it('renders all form fields with initial defaults and helper text', () => {
      const { getByTestId, getByText } = renderWithProviders(<NewClientScreen />);

      expect(getByTestId('client-new-screen')).toBeTruthy();
      expect(getByTestId('client-name-input')).toBeTruthy();
      expect(getByTestId('client-revenue-input')).toBeTruthy();
      expect(getByTestId('client-revenue-helper')).toBeTruthy();
      expect(getByText('Optional. Defaults to 0 if left blank.')).toBeTruthy();
      expect(getByTestId('client-company-input')).toBeTruthy();
      expect(getByTestId('client-email-input')).toBeTruthy();
      expect(getByTestId('client-type-company')).toBeTruthy();
      expect(getByTestId('client-type-individual')).toBeTruthy();
      expect(getByTestId('client-status-active')).toBeTruthy();
      expect(getByTestId('client-payment-onetime')).toBeTruthy();
      expect(getByTestId('client-payment-retainer')).toBeTruthy();
      expect(getByTestId('client-save-button')).toBeTruthy();
      expect(getByTestId('client-cancel-button')).toBeTruthy();
    });

    it('rejects empty name with localized validation error and prevents write', async () => {
      const { getByTestId, findByText } = renderWithProviders(<NewClientScreen />);

      fireEvent.changeText(getByTestId('client-revenue-input'), '500');
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Client name is required.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/clients/create')).toBe(0);
    });

    test.each([
      ['standard decimal dot', '2500.50', 2500.5],
      ['Arabic-Indic digits', '٢٥٠٠٫٥٠', 2500.5],
      ['decimal comma', '2500,50', 2500.5],
      ['blank amount (defaults to 0)', '', 0],
    ])('handles localized amount parsing: %s (%s -> %s)', async (_, inputStr, expectedNum) => {
      const { getByTestId } = renderWithProviders(<NewClientScreen />);

      fireEvent.changeText(getByTestId('client-name-input'), 'Apex Digital');
      fireEvent.changeText(getByTestId('client-revenue-input'), inputStr);
      fireEvent.press(getByTestId('client-save-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const req = mockServer.getRequests().find((r) => r.path === '/api/clients/create');
      expect(req).toBeTruthy();
      expect(req?.body.revenue).toBe(expectedNum);
    });

    test.each([
      ['malformed letters', 'abc'],
      ['multiple separators', '1,2,3'],
      ['infinity string', 'Infinity'],
      ['negative amount', '-100'],
    ])('rejects invalid/negative amount %s without saving as 0', async (_, invalidInput) => {
      const { getByTestId, findByText } = renderWithProviders(<NewClientScreen />);

      fireEvent.changeText(getByTestId('client-name-input'), 'Invalid Amount Co');
      fireEvent.changeText(getByTestId('client-revenue-input'), invalidInput);
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Please enter a valid non-negative amount.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/clients/create')).toBe(0);
    });

    test.each([
      ['letters appended', '12abc'],
      ['decimal point in day', '12.5'],
      ['below range', '0'],
      ['above range', '29'],
      ['blank retainer billing day', '   '],
    ])('rejects invalid/blank retainer billing day %s', async (_, invalidDay) => {
      const { getByTestId, findByText } = renderWithProviders(<NewClientScreen />);

      fireEvent.changeText(getByTestId('client-name-input'), 'Retainer Test');
      fireEvent.press(getByTestId('client-payment-retainer'));
      fireEvent.changeText(getByTestId('client-billing-day-input'), invalidDay);
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Billing day must be a whole number between 1 and 28.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/clients/create')).toBe(0);
    });

    it('creates a retainer client with localized Arabic billing day', async () => {
      const { getByTestId } = renderWithProviders(<NewClientScreen />);

      fireEvent.changeText(getByTestId('client-name-input'), 'Monthly Retainer Client');
      fireEvent.changeText(getByTestId('client-revenue-input'), '3000');
      fireEvent.press(getByTestId('client-payment-retainer'));
      fireEvent.changeText(getByTestId('client-billing-day-input'), '١٠');

      fireEvent.press(getByTestId('client-save-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const req = mockServer.getRequests().find((r) => r.path === '/api/clients/create');
      expect(req).toBeTruthy();
      expect(req?.body.paymentType).toBe('retainer');
      expect(req?.body.billingDay).toBe(10);
      expect(req?.body.nextBillingDate).toMatch(/^\d{4}-\d{2}-10/);
    });

    it('rejects invalid email in Arabic with localized error message (no raw Zod English)', async () => {
      const { getByTestId, findByText, queryByText } = renderWithProviders(
        <NewClientScreen />,
        'ar'
      );

      fireEvent.changeText(getByTestId('client-name-input'), 'عميل تجريبي');
      fireEvent.changeText(getByTestId('client-email-input'), 'notanemail');
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('يرجى إدخال عنوان بريد إلكتروني صالح.')).toBeTruthy();
      expect(queryByText(/Invalid email/i)).toBeNull();
      expect(mockServer.getRequestCount('POST', '/api/clients/create')).toBe(0);
    });

    it('retains user inputs and displays error banner when server creation fails', async () => {
      mockServer.setError('/api/clients/create', 500, { error: 'Database timeout' });

      const { getByTestId, findByText } = renderWithProviders(<NewClientScreen />);

      fireEvent.changeText(getByTestId('client-name-input'), 'Persistent Client');
      fireEvent.changeText(getByTestId('client-revenue-input'), '1200');
      fireEvent.changeText(getByTestId('client-company-input'), 'Persistent LLC');
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Database timeout')).toBeTruthy();

      expect(getByTestId('client-name-input').props.value).toBe('Persistent Client');
      expect(getByTestId('client-revenue-input').props.value).toBe('1200');
      expect(getByTestId('client-company-input').props.value).toBe('Persistent LLC');
    });

    it('blocks save writes when offline and does not queue write', async () => {
      act(() => {
        setNetworkOnline(false);
      });

      const { getByTestId, findByText } = renderWithProviders(<NewClientScreen />);

      expect(await findByText('You are offline. Cannot save client.')).toBeTruthy();

      fireEvent.changeText(getByTestId('client-name-input'), 'Offline Client');
      fireEvent.changeText(getByTestId('client-revenue-input'), '1000');

      const saveBtn = getByTestId('client-save-button');
      fireEvent.press(saveBtn);

      expect(mockServer.getRequestCount('POST', '/api/clients/create')).toBe(0);
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  // ===================== CLIENT DETAIL & KEYED EDITOR =====================
  describe('ClientDetailScreen & Loaded Keyed Editor', () => {
    beforeEach(() => {
      mockLocalSearchParams = { id: 'client-retainer-1' };
    });

    it('renders loading state with localized Loading label when query is pending', () => {
      mockServer.setPending('/api/dashboard/overview');

      const { getByTestId, queryByTestId, getByText } = renderWithProviders(<ClientDetailScreen />);

      expect(getByTestId('client-detail-loading')).toBeTruthy();
      expect(getByText('Loading…')).toBeTruthy();
      expect(queryByTestId('client-detail-screen')).toBeNull();

      mockServer.resolvePending('/api/dashboard/overview');
    });

    it('renders error state with retry button on network failure without cached client', async () => {
      mockServer.setError('/api/dashboard/overview', 500, { error: 'Network crashed' });

      const { findByTestId, findByText, queryByTestId } = renderWithProviders(<ClientDetailScreen />);

      expect(await findByTestId('client-detail-error')).toBeTruthy();
      expect(await findByText('Network crashed')).toBeTruthy();
      expect(await findByText('Try again')).toBeTruthy();
      expect(queryByTestId('client-not-found')).toBeNull();
    });

    it('hydrates client detail after delayed initial response', async () => {
      mockServer.setPending('/api/dashboard/overview');

      const { getByTestId, findByTestId, getAllByText } = renderWithProviders(<ClientDetailScreen />);
      expect(getByTestId('client-detail-loading')).toBeTruthy();

      mockServer.resolvePending('/api/dashboard/overview');

      expect(await findByTestId('client-detail-screen')).toBeTruthy();
      expect(getAllByText('Atlas Creative').length).toBeGreaterThanOrEqual(1);
    });

    it('preserves unsaved form inputs across background overview refetches (loaded keyed editor)', async () => {
      const { findByTestId, getByTestId } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');

      // Toggle edit mode
      fireEvent.press(getByTestId('client-edit-toggle'));

      // User types unsaved changes in edit form
      fireEvent.changeText(getByTestId('edit-client-name-input'), 'Atlas Creative Unsaved Edits');
      fireEvent.changeText(getByTestId('edit-client-revenue-input'), '9999');

      // Trigger background refetch of overview
      await act(async () => {
        await testQueryClient.refetchQueries({ queryKey: ['overview', 'user-123'] });
      });

      // Inputs preserved!
      expect(getByTestId('edit-client-name-input').props.value).toBe('Atlas Creative Unsaved Edits');
      expect(getByTestId('edit-client-revenue-input').props.value).toBe('9999');
    });

    it('blocks clearing existing nonempty company and email with localized field errors', async () => {
      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-edit-toggle'));

      // Clear existing company "Atlas Media Group" and email "hello@atlascreative.com"
      fireEvent.changeText(getByTestId('edit-client-company-input'), '');
      fireEvent.changeText(getByTestId('edit-client-email-input'), '');
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Company cannot be cleared once set.')).toBeTruthy();
      expect(await findByText('Email cannot be cleared once set.')).toBeTruthy();

      // Zero HTTP PUT requests sent!
      expect(mockServer.getRequestCount('PUT', '/api/clients/update/client-retainer-1')).toBe(0);
    });

    it('rejects invalid amount and blank billing day on edit with localized errors', async () => {
      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-edit-toggle'));

      fireEvent.changeText(getByTestId('edit-client-revenue-input'), 'invalid-amount');
      fireEvent.changeText(getByTestId('edit-client-billing-day-input'), '');
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Please enter a valid non-negative amount.')).toBeTruthy();
      expect(await findByText('Billing day must be a whole number between 1 and 28.')).toBeTruthy();
      expect(mockServer.getRequestCount('PUT', '/api/clients/update/client-retainer-1')).toBe(0);
    });

    it('saves client edits and updates UI after server response and overview refetch', async () => {
      const { findByTestId, getByTestId, getAllByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-edit-toggle'));

      fireEvent.changeText(getByTestId('edit-client-name-input'), 'Atlas Global Creative');
      fireEvent.changeText(getByTestId('edit-client-revenue-input'), '4500');
      fireEvent.press(getByTestId('client-save-button'));

      await waitFor(() => {
        expect(mockServer.getRequestCount('PUT', '/api/clients/update/client-retainer-1')).toBe(1);
      });

      // Assert UI rendered updated name
      await waitFor(() => {
        expect(getAllByText('Atlas Global Creative').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('retains user inputs and displays error banner when edit server call fails', async () => {
      mockServer.setError('/api/clients/update/client-retainer-1', 500, { error: 'Failed to update client' });

      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-edit-toggle'));

      fireEvent.changeText(getByTestId('edit-client-name-input'), 'Atlas Retained Edit');
      fireEvent.press(getByTestId('client-save-button'));

      expect(await findByText('Failed to update client')).toBeTruthy();
      expect(getByTestId('edit-client-name-input').props.value).toBe('Atlas Retained Edit');
    });

    it('records retainer payment and updates schedule without misleading picker', async () => {
      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');

      // Press "Record retainer payment"
      fireEvent.press(getByTestId('client-record-payment-btn'));

      // Modal appears: verifies scheduled date notice is rendered and no date picker is shown
      expect(getByTestId('record-payment-modal')).toBeTruthy();
      expect(getByTestId('record-payment-schedule-info')).toBeTruthy();
      expect(await findByText(/Scheduled billing date: Apr 15, 2026/)).toBeTruthy();

      // Confirm record payment
      fireEvent.press(getByTestId('record-payment-confirm'));

      await waitFor(() => {
        expect(mockServer.getRequestCount('POST', '/api/clients/client-retainer-1/record-payment')).toBe(1);
      });

      // Advanced schedule rendered in UI (next billing moved to May 15)
      expect(await findByText(/Next billing: May 15/)).toBeTruthy();
      // New transaction in history rendered
      expect(await findByText('Atlas Creative retainer payment')).toBeTruthy();
    });

    it('adds pending receivable, updates history, and resets modal state on reopen', async () => {
      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');

      // Open Add Pending modal
      fireEvent.press(getByTestId('client-add-pending-btn'));
      expect(getByTestId('add-pending-payment-modal')).toBeTruthy();

      fireEvent.changeText(getByTestId('pending-amount-input'), '1750');
      fireEvent.changeText(getByTestId('pending-note-input'), 'Q2 Branding Milestone');
      fireEvent.press(getByTestId('pending-submit-btn'));

      await waitFor(() => {
        expect(mockServer.getRequestCount('POST', '/api/transactions/pending')).toBe(1);
      });

      // New pending receivable rendered in history
      expect(await findByText('Q2 Branding Milestone')).toBeTruthy();

      // Reopen modal: verify inputs were reset
      fireEvent.press(getByTestId('client-add-pending-btn'));
      expect(getByTestId('pending-amount-input').props.value).toBe('');
      expect(getByTestId('pending-note-input').props.value).toBe('');
      fireEvent.press(getByTestId('pending-cancel-btn'));
    });

    it('retains user inputs in add pending modal when submission fails', async () => {
      mockServer.setError('/api/transactions/pending', 500, { error: 'Pending queue full' });

      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-add-pending-btn'));

      fireEvent.changeText(getByTestId('pending-amount-input'), '1200');
      fireEvent.changeText(getByTestId('pending-note-input'), 'Unsaved Note');
      fireEvent.press(getByTestId('pending-submit-btn'));

      expect(await findByText('Pending queue full')).toBeTruthy();
      expect(getByTestId('pending-amount-input').props.value).toBe('1200');
      expect(getByTestId('pending-note-input').props.value).toBe('Unsaved Note');
    });

    it('rejects invalid pending amount in Arabic with localized error message (no raw Zod)', async () => {
      const { findByTestId, getByTestId, findByText, queryByText } = renderWithProviders(
        <ClientDetailScreen />,
        'ar'
      );

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-add-pending-btn'));

      fireEvent.changeText(getByTestId('pending-amount-input'), 'badamount');
      fireEvent.press(getByTestId('pending-submit-btn'));

      expect(await findByText('يرجى إدخال مبلغ صحيح غير سالب.')).toBeTruthy();
      expect(queryByText(/Expected number|Invalid/i)).toBeNull();
      expect(mockServer.getRequestCount('POST', '/api/transactions/pending')).toBe(0);
    });

    it('archives active client via DELETE /api/clients/delete/{id} and navigates back', async () => {
      const { findByTestId, getByTestId } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-archive-btn'));
      expect(getByTestId('archive-client-modal')).toBeTruthy();

      fireEvent.press(getByTestId('archive-modal-confirm'));

      await waitFor(() => {
        expect(mockServer.getRequestCount('DELETE', '/api/clients/delete/client-retainer-1')).toBe(1);
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it('restores archived client and switches available actions in UI', async () => {
      mockLocalSearchParams = { id: 'client-archived-1' };

      const { findByTestId, getByTestId, queryByTestId } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');

      // Click "Restore" button
      const restoreBtn = await findByTestId('client-restore-btn');
      fireEvent.press(restoreBtn);

      await waitFor(() => {
        expect(mockServer.getRequestCount('PATCH', '/api/clients/restore/client-archived-1')).toBe(1);
      });

      // Overview invalidation refreshed client to ACTIVE: Archive button now visible, Restore button gone
      expect(await findByTestId('client-archive-btn')).toBeTruthy();
      expect(queryByTestId('client-restore-btn')).toBeNull();
    });

    it('handles count-safety regression with cached success then reopen on deferred count fetch and HTTP failure', async () => {
      mockLocalSearchParams = { id: 'client-archived-1' };

      const { findByTestId, getByTestId, findByText } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');

      // 1. Initial dialog open: count resolves successfully with cached 1
      fireEvent.press(getByTestId('client-delete-permanent-btn'));
      expect(await findByTestId('delete-count-ready')).toBeTruthy();
      expect(await findByText(/1 historical transaction totaling \$800\.00 will be removed/)).toBeTruthy();
      expect(getByTestId('permanent-delete-confirm').props.accessibilityState?.disabled).toBe(false);

      // Close modal
      fireEvent.press(getByTestId('permanent-delete-cancel'));

      // 2. Server now has updated transactions (3 transactions)
      const currentTx = mockServer.getState().transactions;
      mockServer.setTransactions([
        ...currentTx,
        {
          id: 'tx-extra-1',
          name: 'Extra 1',
          amount: 100,
          type: 'INCOME',
          status: 'COMPLETED',
          date: '2026-01-01',
          clientId: 'client-archived-1',
          sourceType: 'client',
          categoryId: 'CLIENT',
        },
        {
          id: 'tx-extra-2',
          name: 'Extra 2',
          amount: 100,
          type: 'INCOME',
          status: 'COMPLETED',
          date: '2026-01-02',
          clientId: 'client-archived-1',
          sourceType: 'client',
          categoryId: 'CLIENT',
        },
      ]);

      // Set new count fetch to be deferred / pending
      mockServer.setPending('/api/clients/client-archived-1/transaction-count');

      // Reopen modal: staleTime 0 triggers a new count fetch
      fireEvent.press(getByTestId('client-delete-permanent-btn'));

      // Wait until the count request has arrived at mockServer and is held pending
      await waitFor(() => {
        expect(
          mockServer.getRequests().filter((r) => r.path.includes('transaction-count')).length
        ).toBe(2);
      });

      // While new fetch is delayed: loading indicator is visible and delete confirm is disabled
      expect(getByTestId('delete-count-loading')).toBeTruthy();
      expect(getByTestId('permanent-delete-confirm').props.accessibilityState?.disabled).toBe(true);

      // Attempt to press delete while delayed: ZERO HTTP delete requests sent!
      fireEvent.press(getByTestId('permanent-delete-confirm'));
      expect(mockServer.getRequestCount('DELETE', '/api/clients/delete-permanent/client-archived-1')).toBe(0);

      // 3. Resolve the deferred count request with 500 HTTP failure
      await act(async () => {
        mockServer.resolvePending(
          '/api/clients/client-archived-1/transaction-count',
          { error: 'Count service crashed' },
          500
        );
      });

      // Error and retry button visible, delete button is STILL disabled!
      expect(await findByTestId('delete-count-error')).toBeTruthy();
      expect(await findByText('Failed to check linked transactions.')).toBeTruthy();
      expect(getByTestId('permanent-delete-confirm').props.accessibilityState?.disabled).toBe(true);

      // Attempt to press delete while in error: ZERO HTTP delete requests sent!
      fireEvent.press(getByTestId('permanent-delete-confirm'));
      expect(mockServer.getRequestCount('DELETE', '/api/clients/delete-permanent/client-archived-1')).toBe(0);

      // 4. Press Retry: succeeds and count is updated to 3
      fireEvent.press(getByTestId('delete-count-retry-btn'));

      expect(await findByTestId('delete-count-ready')).toBeTruthy();
      expect(await findByText(/3 historical transactions totaling \$800\.00 will be removed/)).toBeTruthy();

      // Delete confirm is now enabled and deletes successfully
      expect(getByTestId('permanent-delete-confirm').props.accessibilityState?.disabled).toBe(false);
      fireEvent.press(getByTestId('permanent-delete-confirm'));

      await waitFor(() => {
        expect(
          mockServer.getRequestCount('DELETE', '/api/clients/delete-permanent/client-archived-1')
        ).toBe(1);
        expect(mockBack).toHaveBeenCalled();
      });
    });

    // Data-driven offline test: open online -> disconnect -> attempt confirm -> reconnect -> prove 0 writes & 0 queued mutations
    test.each([
      ['edit client', 'client-edit-toggle', 'client-save-button', 'PUT', '/api/clients/update'],
      ['record payment', 'client-record-payment-btn', 'record-payment-confirm', 'POST', '/api/clients/client-retainer-1/record-payment'],
      ['archive client', 'client-archive-btn', 'archive-modal-confirm', 'DELETE', '/api/clients/delete/client-retainer-1'],
    ])('offline transition blocks %s with zero queued writes after reconnect', async (_, openTriggerId, confirmBtnId, method, pathSnippet) => {
      const { findByTestId, getByTestId } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId(openTriggerId));

      // Network drops while sheet/editor is open
      act(() => {
        setNetworkOnline(false);
      });

      // Attempt to confirm write while offline
      const confirmBtn = getByTestId(confirmBtnId);
      fireEvent.press(confirmBtn);

      // Assert zero writes dispatched and zero mutations in pending/paused state
      expect(mockServer.getRequestCount(method, pathSnippet)).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.status === 'pending' || m.state.isPaused).length
      ).toBe(0);

      // Reconnect network
      act(() => {
        setNetworkOnline(true);
      });

      // Wait for any potential queued settlement
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      // Assert still ZERO writes and zero paused mutations
      expect(mockServer.getRequestCount(method, pathSnippet)).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.isPaused).length
      ).toBe(0);
    });

    it('offline transition blocks permanent delete with zero queued writes after reconnect', async () => {
      mockLocalSearchParams = { id: 'client-archived-1' };

      const { findByTestId, getByTestId } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-delete-permanent-btn'));

      // Wait for count to resolve
      expect(await findByTestId('delete-count-ready')).toBeTruthy();

      // Network drops
      act(() => {
        setNetworkOnline(false);
      });

      const confirmBtn = getByTestId('permanent-delete-confirm');
      fireEvent.press(confirmBtn);

      expect(mockServer.getRequestCount('DELETE', '/api/clients/delete-permanent/client-archived-1')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.status === 'pending' || m.state.isPaused).length
      ).toBe(0);

      act(() => {
        setNetworkOnline(true);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      expect(mockServer.getRequestCount('DELETE', '/api/clients/delete-permanent/client-archived-1')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.isPaused).length
      ).toBe(0);
    });

    it('offline transition blocks add pending receivable with zero queued writes after reconnect', async () => {
      const { findByTestId, getByTestId } = renderWithProviders(<ClientDetailScreen />);

      await findByTestId('client-detail-screen');
      fireEvent.press(getByTestId('client-add-pending-btn'));

      // Enter valid amount before network drops
      fireEvent.changeText(getByTestId('pending-amount-input'), '500');

      // Network drops
      act(() => {
        setNetworkOnline(false);
      });

      const confirmBtn = getByTestId('pending-submit-btn');
      fireEvent.press(confirmBtn);

      expect(mockServer.getRequestCount('POST', '/api/transactions/pending')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.status === 'pending' || m.state.isPaused).length
      ).toBe(0);

      act(() => {
        setNetworkOnline(true);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      expect(mockServer.getRequestCount('POST', '/api/transactions/pending')).toBe(0);
      expect(
        testQueryClient.getMutationCache().getAll().filter((m) => m.state.isPaused).length
      ).toBe(0);
    });

    it('renders in Arabic (RTL) and Dark mode correctly', async () => {
      const { findByTestId, findByText, getAllByText } = renderWithProviders(
        <ClientDetailScreen />,
        'ar',
        'dark'
      );

      await findByTestId('client-detail-screen');
      expect(getAllByText('Atlas Creative').length).toBeGreaterThanOrEqual(1);
      expect(await findByText('سجل الدفعات')).toBeTruthy();
      expect(await findByText('نشط')).toBeTruthy(); // Localized status label
    });
  });
});
