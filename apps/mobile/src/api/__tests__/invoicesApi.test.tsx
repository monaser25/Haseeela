import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  fetchInvoicesApi,
  createInvoiceApi,
  updateInvoiceApi,
  deleteInvoiceApi,
  markInvoicePaidApi,
  sendInvoiceApi,
} from '../invoicesApi';
import {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useMarkInvoicePaid,
  useSendInvoice,
} from '../invoiceHooks';
import {
  mockServer,
  mockInvoiceStore,
  setupMockInvoiceServer,
  createTestQueryClient,
  defaultMockPreferences,
} from '../../test';
import { setSupabaseClientForTesting } from '../../auth/supabase';

jest.mock('../../auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    status: 'signedIn',
    signOut: jest.fn(),
  }),
}));

const originalFetch = global.fetch;

describe('Invoices API & Hooks', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let unregisterMock: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.reset({ preferences: defaultMockPreferences });
    mockInvoiceStore.reset();
    unregisterMock = setupMockInvoiceServer(mockServer);
    global.fetch = mockServer.fetchHandler;

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: { access_token: 'valid-test-token', user: { id: 'user-123' } },
          },
          error: null,
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    } as any);

    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    unregisterMock();
    global.fetch = originalFetch;
    queryClient.cancelQueries();
    queryClient.clear();
    queryClient.getMutationCache().clear();
  });

  const wrapper = ({ children }: { children: any }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Direct API Functions', () => {
    it('fetchInvoicesApi returns derived invoices', async () => {
      const invoices = await fetchInvoicesApi();
      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices.length).toBeGreaterThanOrEqual(4);

      // Verify that past due SENT invoice is derived as OVERDUE
      const overdueInv = invoices.find((i) => i.id === 'inv-1');
      expect(overdueInv?.status).toBe('OVERDUE');
    });

    it('createInvoiceApi creates a new draft invoice with computed totals', async () => {
      const created = await createInvoiceApi({
        clientId: 'client-1',
        currency: 'USD',
        issueDate: '2026-03-20',
        dueDate: '2026-04-20',
        taxRate: 10,
        discount: 50,
        lineItems: [
          { description: 'Consulting', quantity: 2, rate: 200 },
        ],
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe('DRAFT');
      expect(created.subtotal).toBe(400); // 2 * 200
      expect(created.taxAmount).toBe(35); // (400 - 50) * 0.1
      expect(created.total).toBe(385); // 350 + 35
    });

    it('updateInvoiceApi modifies invoice without overriding status to SENT or PAID', async () => {
      const updated = await updateInvoiceApi('inv-4', {
        number: 'INV-0041-REV',
        currency: 'EUR',
        lineItems: [
          { description: 'Updated Item', quantity: 1, rate: 1000 },
        ],
      });

      expect(updated.number).toBe('INV-0041-REV');
      expect(updated.status).toBe('DRAFT');
      expect(updated.total).toBe(1000);
    });

    it('deleteInvoiceApi removes invoice', async () => {
      const res = await deleteInvoiceApi('inv-4');
      expect(res.id).toBe('inv-4');

      const all = await fetchInvoicesApi();
      expect(all.find((i) => i.id === 'inv-4')).toBeUndefined();
    });

    it('markInvoicePaidApi is idempotent: returns transaction on first call and null on repeat', async () => {
      // First call: marks inv-2 as PAID and creates income transaction
      const firstCall = await markInvoicePaidApi('inv-2');
      expect(firstCall.invoice.status).toBe('PAID');
      expect(firstCall.invoice.paidAt).toBeDefined();
      expect(firstCall.transaction).not.toBeNull();
      expect(firstCall.transaction?.amount).toBe(firstCall.invoice.total);

      // Repeat call on same invoice: idempotent, returns null transaction
      const secondCall = await markInvoicePaidApi('inv-2');
      expect(secondCall.invoice.status).toBe('PAID');
      expect(secondCall.transaction).toBeNull();
    });

    it('sendInvoiceApi marks status SENT and sets sentAt', async () => {
      const result = await sendInvoiceApi('inv-4', {
        to: 'client@example.com',
        message: 'Here is your invoice',
      });

      expect(result.invoice.status).toBe('SENT');
      expect(result.invoice.sentAt).toBeDefined();
      expect(result.sentTo).toBe('client@example.com');
      expect(result.attached).toBe(true);
    });
  });

  describe('React Query Hooks', () => {
    it('useInvoices query loads invoices under [invoices, userId]', async () => {
      const { result, unmount } = renderHook(() => useInvoices(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.length).toBeGreaterThanOrEqual(4);
      unmount();
    });

    it('useInvoice loads single invoice from cache or server', async () => {
      const { result, unmount } = renderHook(() => useInvoice('inv-1'), { wrapper });

      await waitFor(() => expect(result.current.data?.id).toBe('inv-1'));
      expect(result.current.data?.number).toBe('INV-0044');
      unmount();
    });

    it('useMarkInvoicePaid immediately updates cache and upserts transaction into overview', async () => {
      // Seed overview query cache
      queryClient.setQueryData(['overview', 'user-123'], {
        clients: [],
        subscriptions: [],
        transactions: [],
      });

      const { result: markPaidHook, unmount } = renderHook(() => useMarkInvoicePaid(), { wrapper });

      await act(async () => {
        await markPaidHook.current.mutateAsync('inv-2');
      });

      const cachedInvoices = queryClient.getQueryData<any[]>(['invoices', 'user-123']);
      const updatedInv = cachedInvoices?.find((i) => i.id === 'inv-2');
      expect(updatedInv?.status).toBe('PAID');

      // Overview transactions should have the new income transaction
      const cachedOverview = queryClient.getQueryData<any>(['overview', 'user-123']);
      expect(cachedOverview.transactions.length).toBe(1);
      expect(cachedOverview.transactions[0].name).toContain('Payment — INV-0043');
      unmount();
    });

    it('useCreateInvoice updates query cache with raw created invoice', async () => {
      const { result: createHook, unmount } = renderHook(() => useCreateInvoice(), { wrapper });

      let created: any;
      await act(async () => {
        created = await createHook.current.mutateAsync({
          clientId: 'client-1',
          currency: 'USD',
          issueDate: '2026-03-20',
          dueDate: '2026-04-20',
          taxRate: 0,
          discount: 0,
          lineItems: [{ description: 'New Task', quantity: 1, rate: 500 }],
        });
      });

      expect(created?.id).toBeDefined();
      expect(created?.total).toBe(500);
      const cached = queryClient.getQueryData<any[]>(['invoices', 'user-123']);
      const found = cached?.find((i) => i.id === created?.id);
      expect(found).toBeDefined();
      expect(found?.total).toBe(500);
      unmount();
    });

    it('useUpdateInvoice updates query cache with raw updated invoice', async () => {
      const { result: updateHook, unmount } = renderHook(() => useUpdateInvoice(), { wrapper });

      let updated: any;
      await act(async () => {
        updated = await updateHook.current.mutateAsync({
          id: 'inv-4',
          data: {
            lineItems: [{ description: 'Revised', quantity: 2, rate: 600 }],
          },
        });
      });

      expect(updated?.id).toBe('inv-4');
      expect(updated?.total).toBe(1200);
      const cached = queryClient.getQueryData<any[]>(['invoices', 'user-123']);
      const found = cached?.find((i) => i.id === 'inv-4');
      expect(found?.total).toBe(1200);
      unmount();
    });
  });
});
