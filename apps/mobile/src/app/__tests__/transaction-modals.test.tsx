import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewTransactionScreen from '../(app)/transaction/new';
import TransactionDetailScreen from '../(app)/transaction/[id]';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as onlineModule from '../../query/useIsOnline';
import { setSupabaseClientForTesting } from '../../auth/supabase';
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

const sampleTransactions = [
  {
    id: 'tx-manual-1',
    name: 'Manual Consulting',
    amount: 1200,
    type: 'INCOME' as const,
    status: 'COMPLETED' as const,
    date: '2026-03-20',
    notes: 'Consulting notes',
    sourceType: 'manual' as const,
    categoryId: 'CLIENT',
  },
  {
    id: 'tx-auto-1',
    name: 'Hosting Monthly',
    amount: 40,
    type: 'EXPENSE' as const,
    status: 'COMPLETED' as const,
    date: '2026-03-15',
    notes: 'Auto subscription',
    sourceType: 'subscription' as const,
    categoryId: 'TOOLS',
    isAuto: true,
  },
  {
    id: 'tx-invoice-1',
    name: 'Payment — INV-001',
    amount: 5000,
    type: 'INCOME' as const,
    status: 'COMPLETED' as const,
    date: '2026-03-12',
    sourceType: 'invoice' as const,
    categoryId: 'CLIENT',
    isAuto: true,
  },
  {
    id: 'tx-pending-1',
    name: 'Pending Milestone 2',
    amount: 2500,
    type: 'INCOME' as const,
    status: 'PENDING' as const,
    date: '2026-03-01', // date differs from expectedDate
    expectedDate: '2026-03-10',
    sourceType: 'client' as const,
    categoryId: 'CLIENT',
    clientId: 'client-1',
  },
  {
    id: 'tx-completed-pending-1',
    name: 'Completed Milestone 1',
    amount: 3000,
    type: 'INCOME' as const,
    status: 'COMPLETED' as const,
    date: '2026-03-14',
    expectedDate: '2026-03-10',
    completedAt: '2026-03-14',
    sourceType: 'client' as const,
    categoryId: 'CLIENT',
    clientId: 'client-1',
  },
];

const sampleClients = [
  { id: 'client-1', name: 'Apex Ltd', revenue: 5000, clientType: 'INDIVIDUAL' as const, status: 'ACTIVE' as const, paymentType: 'onetime' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'client-2', name: 'Globex Corp', revenue: 3000, clientType: 'INDIVIDUAL' as const, status: 'ACTIVE' as const, paymentType: 'onetime' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
];

describe('NewTransactionScreen and TransactionDetailScreen', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalSearchParams = {};
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    setNetworkOnline(true);

    mockServer.reset({
      transactions: sampleTransactions as any,
      clients: sampleClients,
      preferences: { ...defaultMockPreferences, currency: 'USD' },
    });
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
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
    setSupabaseClientForTesting(null);
  });

  function renderWithProviders(component: React.ReactElement, initialLocale = 'en' as const) {
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

    const rendered = render(wrap(component));
    return {
      ...rendered,
      wrap,
    };
  }

  describe('NewTransactionScreen', () => {
    it('shows validation errors when name or amount are missing/empty', async () => {
      mockLocalSearchParams = { type: 'EXPENSE' };
      const { getByTestId } = renderWithProviders(<NewTransactionScreen />);

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockServer.getRequestCount('POST', '/api/transactions/create')).toBe(0);
      });
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('creates an income transaction with valid input and navigates back', async () => {
      mockLocalSearchParams = { type: 'INCOME' };
      const { getByTestId } = renderWithProviders(<NewTransactionScreen />);

      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');
      const notesInput = getByTestId('tx-notes-input');

      fireEvent.changeText(nameInput, 'Mobile App Sprint');
      fireEvent.changeText(amountInput, '2500.50');
      fireEvent.changeText(notesInput, 'Sprint 1 payment');

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('POST', '/api/transactions/create')).toBe(1);
      const postReq = mockServer.getRequests().find((r) => r.method === 'POST' && r.path === '/api/transactions/create');
      expect(postReq?.body).toEqual(
        expect.objectContaining({
          name: 'Mobile App Sprint',
          amount: 2500.5,
          type: 'INCOME',
          sourceType: 'manual',
          categoryId: 'CLIENT',
          notes: 'Sprint 1 payment',
        })
      );
    });

    it('handles Arabic decimal comma and numbers in amount field', async () => {
      mockLocalSearchParams = { type: 'EXPENSE' };
      const { getByTestId } = renderWithProviders(<NewTransactionScreen />);

      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');

      fireEvent.changeText(nameInput, 'Software License');
      // Using comma decimal separator as common in Arabic
      fireEvent.changeText(amountInput, '150,75');

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const postReq = mockServer.getRequests().find((r) => r.method === 'POST' && r.path === '/api/transactions/create');
      expect(postReq?.body).toEqual(
        expect.objectContaining({
          amount: 150.75,
          type: 'EXPENSE',
        })
      );
    });

    it('disables save button when offline and shows offline banner', async () => {
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
      setNetworkOnline(false);
      mockLocalSearchParams = { type: 'EXPENSE' };

      const { getByTestId } = renderWithProviders(<NewTransactionScreen />);

      expect(getByTestId('offline-banner')).toBeTruthy();
      const saveBtn = getByTestId('tx-save-button');
      expect(saveBtn.props.accessibilityState.disabled).toBe(true);

      const writeRequestsBefore = mockServer.getWriteRequests().length;

      // Attempting to press save while offline does not trigger any network request
      await act(async () => {
        fireEvent.press(saveBtn);
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);

      // Reconnect online: ensure no queued mutation fires
      await act(async () => {
        setNetworkOnline(true);
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
    });

    it('HTTP errors do not lose form input on transaction creation failure', async () => {
      mockLocalSearchParams = { type: 'INCOME' };
      // Simulate backend 500 error on creation
      mockServer.setError('/api/transactions/create', 500, { error: 'Database creation failure' });

      const { getByTestId } = renderWithProviders(<NewTransactionScreen />);

      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');
      const notesInput = getByTestId('tx-notes-input');

      fireEvent.changeText(nameInput, 'Freelance Retainer');
      fireEvent.changeText(amountInput, '3200.00');
      fireEvent.changeText(notesInput, 'Quarterly retainer contract');

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      // Wait for error banner
      await waitFor(() => {
        expect(getByTestId('general-error-banner')).toBeTruthy();
      });

      // Verify user form input was NOT lost or wiped
      expect(getByTestId('tx-name-input').props.value).toBe('Freelance Retainer');
      expect(getByTestId('tx-amount-input').props.value).toBe('3200.00');
      expect(getByTestId('tx-notes-input').props.value).toBe('Quarterly retainer contract');
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  describe('TransactionDetailScreen (Edit & View)', () => {
    it('hydrates form state when overview finishes loading', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      // Hold overview pending
      mockServer.setPending('/api/dashboard/overview');

      const { getByTestId, queryByTestId } = renderWithProviders(
        <TransactionDetailScreen />
      );

      expect(getByTestId('tx-detail-loading')).toBeTruthy();
      expect(queryByTestId('tx-name-input')).toBeNull();

      // Resolve overview request
      mockServer.resolvePending('/api/dashboard/overview');

      await waitFor(() => {
        expect(getByTestId('tx-name-input')).toBeTruthy();
      });

      const nameInput = getByTestId('tx-name-input');
      expect(nameInput.props.value).toBe('Manual Consulting');
      const amountInput = getByTestId('tx-amount-input');
      expect(amountInput.props.value).toBe('1200');
    });

    it('preserves unsaved user edits when overview refetches in background', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-name-input')).toBeTruthy();
      });

      const nameInput = getByTestId('tx-name-input');
      expect(nameInput.props.value).toBe('Manual Consulting');

      // User types unsaved changes
      fireEvent.changeText(nameInput, 'Unsaved User Input');
      expect(nameInput.props.value).toBe('Unsaved User Input');

      // Update server data and trigger background query invalidation/refetch
      mockServer.setTransactions([
        { ...sampleTransactions[0], name: 'Server Remote Updated' },
        ...sampleTransactions.slice(1),
      ] as any);

      await act(async () => {
        await testQueryClient.invalidateQueries({ queryKey: ['overview', 'user-123'] });
      });

      // Unsaved user edit should be preserved, not overwritten by server refetch
      await waitFor(() => {
        expect(getByTestId('tx-name-input').props.value).toBe('Unsaved User Input');
      });
    });

    it('initializes pending payment expectedDate ahead of date and untouched save preserves expectedDate', async () => {
      mockLocalSearchParams = { id: 'tx-pending-1' };
      // In sampleTransactions: tx-pending-1 has date='2026-03-01' and expectedDate='2026-03-10'
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-save-button')).toBeTruthy();
      });

      // Untouched save
      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('PATCH', '/api/transactions/pending/tx-pending-1')).toBe(1);
      const patchReq = mockServer.getRequests().find((r) => r.method === 'PATCH' && r.path === '/api/transactions/pending/tx-pending-1');
      expect(patchReq?.body).toEqual(
        expect.objectContaining({
          amount: 2500,
          expectedDate: '2026-03-10', // preserved expectedDate, not date '2026-03-01'
        })
      );
    });

    it('validates detail form updates using shared schema and shows errors on invalid input', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-name-input')).toBeTruthy();
      });

      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');

      // Clear name and enter invalid amount
      fireEvent.changeText(nameInput, '   ');
      fireEvent.changeText(amountInput, '-50');

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockServer.getRequestCount('PUT', '/api/transactions/update/tx-manual-1')).toBe(0);
      });
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('loads existing manual transaction details and saves updates', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-name-input')).toBeTruthy();
      });

      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');

      expect(nameInput.props.value).toBe('Manual Consulting');
      expect(amountInput.props.value).toBe('1200');

      fireEvent.changeText(nameInput, 'Updated Consulting');
      fireEvent.changeText(amountInput, '1500');

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('PUT', '/api/transactions/update/tx-manual-1')).toBe(1);
      const putReq = mockServer.getRequests().find((r) => r.method === 'PUT' && r.path === '/api/transactions/update/tx-manual-1');
      expect(putReq?.body).toEqual(
        expect.objectContaining({
          name: 'Updated Consulting',
          amount: 1500,
        })
      );
      expect(mockServer.getState().transactions.find((t) => t.id === 'tx-manual-1')?.name).toBe('Updated Consulting');
    });

    it('opens delete confirmation modal and deletes transaction on confirm', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-delete-button')).toBeTruthy();
      });

      const deleteBtn = getByTestId('tx-delete-button');
      fireEvent.press(deleteBtn);

      expect(getByTestId('delete-transaction-modal')).toBeTruthy();

      const confirmDelete = getByTestId('delete-modal-confirm');
      fireEvent.press(confirmDelete);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('DELETE', '/api/transactions/delete/tx-manual-1')).toBe(1);
      expect(mockServer.getState().transactions.find((t) => t.id === 'tx-manual-1')).toBeUndefined();
    });

    it('shows auto-warning banner for auto-generated transactions and locks category', async () => {
      mockLocalSearchParams = { id: 'tx-auto-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('auto-warning-banner')).toBeTruthy();
      });
    });

    it('allows editing and deleting invoice transactions like standard auto-generated transactions', async () => {
      mockLocalSearchParams = { id: 'tx-invoice-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('auto-warning-banner')).toBeTruthy();
      });

      // Name and amount are editable
      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');
      expect(nameInput.props.editable).not.toBe(false);
      expect(amountInput.props.editable).not.toBe(false);

      // Save and delete buttons are accessible
      const saveBtn = getByTestId('tx-save-button');
      expect(saveBtn).toBeTruthy();
      const deleteBtn = getByTestId('tx-delete-button');
      expect(deleteBtn).toBeTruthy();

      // Can edit and save
      fireEvent.changeText(nameInput, 'Updated Invoice Payment');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('PUT', '/api/transactions/update/tx-invoice-1')).toBe(1);
      const putReq = mockServer.getRequests().find((r) => r.method === 'PUT' && r.path === '/api/transactions/update/tx-invoice-1');
      expect(putReq?.body).toEqual(
        expect.objectContaining({
          name: 'Updated Invoice Payment',
        })
      );
    });

    it('allows marking pending payment as paid from detail screen', async () => {
      mockLocalSearchParams = { id: 'tx-pending-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('pending-status-card')).toBeTruthy();
      });

      const markPaidBtn = getByTestId('detail-mark-as-paid');
      fireEvent.press(markPaidBtn);

      expect(getByTestId('complete-pending-modal')).toBeTruthy();
      const confirmPaid = getByTestId('complete-modal-confirm');
      fireEvent.press(confirmPaid);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('POST', '/api/transactions/pending/tx-pending-1/complete')).toBe(1);
      expect(mockServer.getState().transactions.find((t) => t.id === 'tx-pending-1')?.status).toBe('COMPLETED');
    });

    it('allows reverting a completed transaction back to pending from detail screen', async () => {
      mockLocalSearchParams = { id: 'tx-completed-pending-1' };
      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('revert-status-card')).toBeTruthy();
      });

      const revertBtn = getByTestId('detail-revert-to-pending');
      fireEvent.press(revertBtn);

      expect(getByTestId('revert-pending-modal')).toBeTruthy();
      const confirmRevert = getByTestId('revert-modal-confirm');
      fireEvent.press(confirmRevert);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      expect(mockServer.getRequestCount('POST', '/api/transactions/pending/tx-completed-pending-1/revert')).toBe(1);
      expect(mockServer.getState().transactions.find((t) => t.id === 'tx-completed-pending-1')?.status).toBe('PENDING');
    });

    it('prevents complete mutation when network drops online -> offline while Complete dialog is open (no HTTP write and no queued write on reconnect)', async () => {
      mockLocalSearchParams = { id: 'tx-pending-1' };
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
      setNetworkOnline(true);

      const { getByTestId, rerender, wrap } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('detail-mark-as-paid')).toBeTruthy();
      });

      // Open complete dialog while online
      fireEvent.press(getByTestId('detail-mark-as-paid'));
      expect(getByTestId('complete-pending-modal')).toBeTruthy();

      const writeRequestsBefore = mockServer.getWriteRequests().length;

      // Network drops to offline coherently
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
      setNetworkOnline(false);
      rerender(wrap(<TransactionDetailScreen />));

      // Verify offline warning is displayed inside dialog
      expect(getByTestId('complete-modal-offline-warning')).toBeTruthy();

      // Attempting to confirm must NOT trigger mutation or navigation
      await act(async () => {
        fireEvent.press(getByTestId('complete-modal-confirm'));
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
      expect(mockBack).not.toHaveBeenCalled();

      // Reconnect online: ensure no paused/queued mutation fires
      await act(async () => {
        setNetworkOnline(true);
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('prevents revert mutation when network drops online -> offline while Revert dialog is open (no HTTP write and no queued write on reconnect)', async () => {
      mockLocalSearchParams = { id: 'tx-completed-pending-1' };
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
      setNetworkOnline(true);

      const { getByTestId, rerender, wrap } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('detail-revert-to-pending')).toBeTruthy();
      });

      // Open revert dialog while online
      fireEvent.press(getByTestId('detail-revert-to-pending'));
      expect(getByTestId('revert-pending-modal')).toBeTruthy();

      const writeRequestsBefore = mockServer.getWriteRequests().length;

      // Network drops to offline coherently
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
      setNetworkOnline(false);
      rerender(wrap(<TransactionDetailScreen />));

      // Verify offline warning is displayed inside dialog
      expect(getByTestId('revert-modal-offline-warning')).toBeTruthy();

      // Attempting to confirm must NOT trigger mutation or navigation
      await act(async () => {
        fireEvent.press(getByTestId('revert-modal-confirm'));
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
      expect(mockBack).not.toHaveBeenCalled();

      // Reconnect online: ensure no paused/queued mutation fires
      await act(async () => {
        setNetworkOnline(true);
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('prevents delete mutation when network drops online -> offline while Delete dialog is open (no HTTP write and no queued write on reconnect)', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
      setNetworkOnline(true);

      const { getByTestId, rerender, wrap } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-delete-button')).toBeTruthy();
      });

      // Open delete dialog while online
      fireEvent.press(getByTestId('tx-delete-button'));
      expect(getByTestId('delete-transaction-modal')).toBeTruthy();

      const writeRequestsBefore = mockServer.getWriteRequests().length;

      // Network drops to offline coherently
      (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);
      setNetworkOnline(false);
      rerender(wrap(<TransactionDetailScreen />));

      // Verify offline warning is displayed inside dialog
      expect(getByTestId('delete-modal-offline-warning')).toBeTruthy();

      // Attempting to confirm must NOT trigger mutation or navigation
      await act(async () => {
        fireEvent.press(getByTestId('delete-modal-confirm'));
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
      expect(mockBack).not.toHaveBeenCalled();

      // Reconnect online: ensure no paused/queued mutation fires
      await act(async () => {
        setNetworkOnline(true);
        (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
        await Promise.resolve();
      });

      expect(mockServer.getWriteRequests().length).toBe(writeRequestsBefore);
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('displays confirmation amounts using user account preference currency (EUR) across modals', async () => {
      mockServer.setPreferences({ currency: 'EUR' });

      // 1. Complete modal
      mockLocalSearchParams = { id: 'tx-pending-1' };
      const { getByTestId: getPending, unmount: unmountPending } = renderWithProviders(<TransactionDetailScreen />);
      await waitFor(() => expect(getPending('detail-mark-as-paid')).toBeTruthy());
      fireEvent.press(getPending('detail-mark-as-paid'));
      expect(getPending('complete-modal-amount').props.children).toContain('€');
      unmountPending();

      // 2. Revert modal
      mockLocalSearchParams = { id: 'tx-completed-pending-1' };
      const { getByTestId: getRevert, unmount: unmountRevert } = renderWithProviders(<TransactionDetailScreen />);
      await waitFor(() => expect(getRevert('detail-revert-to-pending')).toBeTruthy());
      fireEvent.press(getRevert('detail-revert-to-pending'));
      expect(getRevert('revert-modal-amount').props.children).toContain('€');
      unmountRevert();

      // 3. Delete modal
      mockLocalSearchParams = { id: 'tx-manual-1' };
      const { getByTestId: getDelete } = renderWithProviders(<TransactionDetailScreen />);
      await waitFor(() => expect(getDelete('tx-delete-button')).toBeTruthy());
      fireEvent.press(getDelete('tx-delete-button'));
      expect(getDelete('delete-modal-amount').props.children).toContain('€');
    });

    it('displays confirmation amounts using user account preference currency (EGP) across modals', async () => {
      mockServer.setPreferences({ currency: 'EGP' });

      // 1. Complete modal
      mockLocalSearchParams = { id: 'tx-pending-1' };
      const { getByTestId: getPending, unmount: unmountPending } = renderWithProviders(<TransactionDetailScreen />);
      await waitFor(() => expect(getPending('detail-mark-as-paid')).toBeTruthy());
      fireEvent.press(getPending('detail-mark-as-paid'));
      expect(getPending('complete-modal-amount').props.children).toContain('EGP');
      unmountPending();

      // 2. Revert modal
      mockLocalSearchParams = { id: 'tx-completed-pending-1' };
      const { getByTestId: getRevert, unmount: unmountRevert } = renderWithProviders(<TransactionDetailScreen />);
      await waitFor(() => expect(getRevert('detail-revert-to-pending')).toBeTruthy());
      fireEvent.press(getRevert('detail-revert-to-pending'));
      expect(getRevert('revert-modal-amount').props.children).toContain('EGP');
      unmountRevert();

      // 3. Delete modal
      mockLocalSearchParams = { id: 'tx-manual-1' };
      const { getByTestId: getDelete } = renderWithProviders(<TransactionDetailScreen />);
      await waitFor(() => expect(getDelete('tx-delete-button')).toBeTruthy());
      fireEvent.press(getDelete('tx-delete-button'));
      expect(getDelete('delete-modal-amount').props.children).toContain('EGP');
    });

    it('HTTP errors on update do not lose form input in detail screen', async () => {
      mockLocalSearchParams = { id: 'tx-manual-1' };
      mockServer.setError('/api/transactions/update/tx-manual-1', 500, { error: 'Failed to update transaction' });

      const { getByTestId } = renderWithProviders(<TransactionDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('tx-name-input')).toBeTruthy();
      });

      const nameInput = getByTestId('tx-name-input');
      const amountInput = getByTestId('tx-amount-input');

      fireEvent.changeText(nameInput, 'Attempted New Name');
      fireEvent.changeText(amountInput, '1850');

      const saveBtn = getByTestId('tx-save-button');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(getByTestId('general-error-banner')).toBeTruthy();
      });

      // Verify form fields were not wiped on error
      expect(getByTestId('tx-name-input').props.value).toBe('Attempted New Name');
      expect(getByTestId('tx-amount-input').props.value).toBe('1850');
      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});
