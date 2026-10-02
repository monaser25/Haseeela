import {
  apiRequest,
  ApiError,
  loadFinancialSnapshot,
  fetchUserPreferences,
  updateUserPreferences,
  createClient,
  createSubscription,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createPendingPayment,
  updatePendingPayment,
  deletePendingPayment,
  completePendingPayment,
  revertPendingPayment,
} from '../client';
import { getSupabaseClient, setSupabaseClientForTesting } from '../../auth/supabase';

// Mock fetch
const originalFetch = global.fetch;

describe('API client: apiRequest', () => {
  const mockSignOut = jest.fn().mockResolvedValue({ error: null });
  const mockGetSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-test-access-token',
          user: { id: 'test-user-id' },
        },
      },
      error: null,
    });

    setSupabaseClientForTesting({
      auth: {
        getSession: mockGetSession,
        signOut: mockSignOut,
      },
    } as any);
  });

  afterAll(() => {
    global.fetch = originalFetch;
    setSupabaseClientForTesting(null);
  });

  it('prefixes EXPO_PUBLIC_API_URL and attaches Bearer authorization header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, count: 42 }),
    });

    const result = await apiRequest<{ success: boolean; count: number }>('/api/test-path');

    expect(result).toEqual({ success: true, count: 42 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/test-path',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-test-access-token',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('sends JSON body correctly', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: 'created-id' }),
    });

    const payload = { title: 'Test Invoice', amount: 500 };
    await apiRequest('/api/invoices', {
      method: 'POST',
      body: payload as any,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/invoices',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  });

  it('parses success JSON response cleanly', async () => {
    const responseData = { clients: [{ id: '1', name: 'Acme Corp' }] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData),
    });

    const data = await apiRequest<typeof responseData>('/api/clients');
    expect(data).toEqual(responseData);
  });

  it('handles 204 No Content returning null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await apiRequest('/api/clients/1', { method: 'DELETE' });
    expect(result).toBeNull();
  });

  it('throws typed ApiError on 400 with parsed server message and code', async () => {
    const errorBody = JSON.stringify({
      error: 'Invalid input data',
      code: 'INVALID_INPUT',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue(errorBody),
    });

    await expect(apiRequest('/api/test')).rejects.toThrow(ApiError);

    try {
      await apiRequest('/api/test');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.message).toBe('Invalid input data');
      expect(apiErr.code).toBe('INVALID_INPUT');
      expect(apiErr.responseBody).toBe(errorBody);
    }
  });

  it('extracts first detail message from zod error details array', async () => {
    const errorBody = JSON.stringify({
      error: 'Validation failed',
      details: [{ path: 'amount', message: 'Amount must be positive' }],
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: jest.fn().mockResolvedValue(errorBody),
    });

    try {
      await apiRequest('/api/test');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.message).toBe('Amount must be positive');
    }
  });

  it('signs user out on 401 response and throws ApiError', async () => {
    const errorBody = JSON.stringify({ error: 'Invalid or expired session' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue(errorBody),
    });

    await expect(apiRequest('/api/protected')).rejects.toThrow(ApiError);

    // Verify local signOut was triggered
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('loadFinancialSnapshot endpoint calls /api/dashboard/overview', async () => {
    const snapshotData = {
      clients: [{ id: 'c1', name: 'Client 1', revenue: 1000, clientType: 'INDIVIDUAL', status: 'ACTIVE', paymentType: 'onetime', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      subscriptions: [],
      transactions: [],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(snapshotData),
    });

    const result = await loadFinancialSnapshot();
    expect(result).toEqual(snapshotData);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/dashboard/overview',
      expect.anything()
    );
  });

  it('fetchUserPreferences calls GET /api/user/preferences', async () => {
    const prefsData = {
      name: 'Sarah',
      email: 'sarah@example.com',
      currency: 'USD',
      onboardedAt: null,
      notifyBillingReminders: true,
      notifyInvoiceDue: true,
      notifyWeeklySummary: true,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(prefsData),
    });

    const result = await fetchUserPreferences();
    expect(result).toEqual(prefsData);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/user/preferences',
      expect.anything()
    );
  });

  it('updateUserPreferences calls PATCH /api/user/preferences with payload', async () => {
    const patchData = { currency: 'EUR' as const, onboardedAt: '2026-03-01T00:00:00.000Z' };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ ...patchData, name: 'Sarah' }),
    });

    await updateUserPreferences(patchData);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/user/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(patchData),
      })
    );
  });

  it('createClient calls POST /api/clients/create with payload', async () => {
    const clientPayload = { name: 'Acme Corp', revenue: 5000 };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ id: 'c123', ...clientPayload }),
    });

    await createClient(clientPayload as any);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/clients/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(clientPayload),
      })
    );
  });

  it('createSubscription calls POST /api/subscriptions/create with payload', async () => {
    const subPayload = { name: 'GitHub Copilot', amount: 10 };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ id: 's123', ...subPayload }),
    });

    await createSubscription(subPayload as any);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/subscriptions/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(subPayload),
      })
    );
  });

  it('createTransaction calls POST /api/transactions/create with payload', async () => {
    const txPayload = { name: 'Design Project', amount: 1500, type: 'INCOME' as const, sourceType: 'manual' as const, categoryId: 'CLIENT', date: '2026-03-01' };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ id: 'tx-1', ...txPayload }),
    });

    await createTransaction(txPayload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/create',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(txPayload),
      })
    );
  });

  it('updateTransaction calls PUT /api/transactions/update/{id} with payload', async () => {
    const updates = { name: 'Updated Project', amount: 1800 };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: 'tx-1', ...updates }),
    });

    await updateTransaction('tx-1', updates);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/update/tx-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(updates),
      })
    );
  });

  it('deleteTransaction calls DELETE /api/transactions/delete/{id}', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    const res = await deleteTransaction('tx-1');
    expect(res).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/delete/tx-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('createPendingPayment calls POST /api/transactions/pending', async () => {
    const data = { clientId: 'client-1', amount: 1200, expectedDate: '2026-04-01', note: 'Milestone 1' };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({ id: 'pending-1', ...data }),
    });

    await createPendingPayment(data);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/pending',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(data),
      })
    );
  });

  it('updatePendingPayment calls PATCH /api/transactions/pending/{id}', async () => {
    const updates = { amount: 1500, note: 'Updated milestone' };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: 'pending-1', ...updates }),
    });

    await updatePendingPayment('pending-1', updates);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/pending/pending-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
    );
  });

  it('deletePendingPayment calls DELETE /api/transactions/pending/{id}', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    const res = await deletePendingPayment('pending-1');
    expect(res).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/pending/pending-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('completePendingPayment calls POST /api/transactions/pending/{id}/complete', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: 'pending-1', status: 'COMPLETED' }),
    });

    await completePendingPayment('pending-1', { completedDate: '2026-03-15' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/pending/pending-1/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ completedDate: '2026-03-15' }),
      })
    );
  });

  it('revertPendingPayment calls POST /api/transactions/pending/{id}/revert', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: 'pending-1', status: 'PENDING' }),
    });

    await revertPendingPayment('pending-1');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://10.0.2.2:3000/api/transactions/pending/pending-1/revert',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
  });
});
