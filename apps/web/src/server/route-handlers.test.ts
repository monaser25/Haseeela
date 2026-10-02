const mockPrisma: any = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn((callback: any): unknown => callback(mockPrisma)),
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  client: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  accountDeletion: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('@/server/prisma', () => ({ prisma: mockPrisma }));

import { GET as getClients } from '@/app/api/clients/route';
import { DELETE as deleteClient } from '@/app/api/clients/delete/[id]/route';
import { DELETE as deleteSubscription } from '@/app/api/subscriptions/delete/[id]/route';
import { DELETE as deleteTransaction } from '@/app/api/transactions/delete/[id]/route';
import { POST as createClient } from '@/app/api/clients/create/route';
import { PUT as updateClient } from '@/app/api/clients/update/[id]/route';
import { PUT as updateSubscription } from '@/app/api/subscriptions/update/[id]/route';
import { PUT as updateTransaction } from '@/app/api/transactions/update/[id]/route';
import { POST as createTransaction } from '@/app/api/transactions/create/route';
import { PATCH as restoreClient } from '@/app/api/clients/restore/[id]/route';
import { PATCH as restoreSubscription } from '@/app/api/subscriptions/restore/[id]/route';

const tokenFor = (id: string) => `flowledger-dev:${encodeURIComponent(JSON.stringify({ id, email: `${id}@example.com` }))}`;

const request = (method: string, path: string, userId = 'user-a', body?: unknown) => new Request(`http://localhost${path}`, {
  method,
  headers: {
    Authorization: `Bearer ${tokenFor(userId)}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('Next route handler safeguards', () => {
  beforeEach(() => {
    process.env.ENABLE_DEV_AUTH = 'true';
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
    mockPrisma.accountDeletion.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-a', email: 'user-a@example.com' });
    // The client one-time-payment sync looks up its single deterministic row;
    // default to "none exists" so retainer/billing edits stay no-ops.
    mockPrisma.transaction.findUnique.mockResolvedValue(null);
    mockPrisma.client.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, userId: 'user-a' }),
    );
  });

  it('only reads data scoped to the authenticated user', async () => {
    mockPrisma.client.findMany.mockImplementation(({ where }: any) => Promise.resolve(
      where.userId === 'user-a' ? [{ id: 'client-a', userId: 'user-a' }] : [{ id: 'client-b', userId: 'user-b' }],
    ));

    const response = await getClients(request('GET', '/api/clients'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: 'client-a', userId: 'user-a' }]);
    expect(mockPrisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-a' },
    }));
  });

  it('prevents updating another user client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    const response = await updateClient(
      request('PUT', '/api/clients/update/client-b', 'user-a', { name: 'Updated' }),
      { params: { id: 'client-b' } },
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.client.findFirst).toHaveBeenCalledWith({ where: { id: 'client-b', userId: 'user-a' } });
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('prevents deleting another user client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    const response = await deleteClient(
      request('DELETE', '/api/clients/delete/client-b'),
      { params: { id: 'client-b' } },
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('soft-removes clients without deleting historical transactions', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-a', userId: 'user-a' });
    mockPrisma.client.update.mockResolvedValue({ id: 'client-a', userId: 'user-a', status: 'INACTIVE', archivedAt: new Date() });

    const response = await deleteClient(
      request('DELETE', '/api/clients/delete/client-a'),
      { params: { id: 'client-a' } },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-a' },
      data: expect.objectContaining({ status: 'INACTIVE', archivedAt: expect.any(Date) }),
    });
  });

  it('soft-removes subscriptions without deleting historical transactions', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-a', userId: 'user-a' });
    mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-a', userId: 'user-a', status: 'INACTIVE', archivedAt: new Date() });

    const response = await deleteSubscription(
      request('DELETE', '/api/subscriptions/delete/sub-a'),
      { params: { id: 'sub-a' } },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-a' },
      data: expect.objectContaining({ status: 'INACTIVE', archivedAt: expect.any(Date) }),
    });
  });

  it('allows editing an auto-generated transaction as a historical record and marks it edited', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce({ id: 'tx-1', userId: 'user-a', sourceType: 'client', isAuto: true, isEdited: false });
    mockPrisma.transaction.findFirst.mockResolvedValueOnce({ id: 'tx-1', userId: 'user-a', sourceType: 'client', isAuto: true, isEdited: true, amount: 250 });
    mockPrisma.transaction.updateMany.mockResolvedValue({ count: 1 });

    const response = await updateTransaction(
      request('PUT', '/api/transactions/update/tx-1', 'user-a', { amount: 250, name: 'Adjusted payment' }),
      { params: { id: 'tx-1' } },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tx-1', userId: 'user-a', deletedAt: null },
      data: expect.objectContaining({ amount: 250, name: 'Adjusted payment', isEdited: true }),
    }));
  });

  it('does not let an auto-transaction edit change its linkage fields', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValueOnce({ id: 'tx-1', userId: 'user-a', sourceType: 'client', sourceId: 'client-1', clientId: 'client-1', isAuto: true });
    mockPrisma.transaction.findFirst.mockResolvedValueOnce({ id: 'tx-1', userId: 'user-a', sourceType: 'client' });
    mockPrisma.transaction.updateMany.mockResolvedValue({ count: 1 });

    await updateTransaction(
      request('PUT', '/api/transactions/update/tx-1', 'user-a', {
        amount: 50,
        sourceType: 'manual',
        sourceId: 'tampered',
        clientId: 'tampered',
        subscriptionId: 'tampered',
      }),
      { params: { id: 'tx-1' } },
    );

    const updateCall = mockPrisma.transaction.updateMany.mock.calls[0][0];
    expect(updateCall.data.sourceType).toBeUndefined();
    expect(updateCall.data.sourceId).toBeUndefined();
    expect(updateCall.data.clientId).toBeUndefined();
    expect(updateCall.data.subscriptionId).toBeUndefined();
  });

  it('allows deleting an auto-generated transaction without touching the source client', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 'tx-1', userId: 'user-a', sourceType: 'subscription', isAuto: true });
    mockPrisma.transaction.deleteMany.mockResolvedValue({ count: 1 });

    const response = await deleteTransaction(
      request('DELETE', '/api/transactions/delete/tx-1'),
      { params: { id: 'tx-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockPrisma.transaction.deleteMany).toHaveBeenCalledWith({ where: { id: 'tx-1', userId: 'user-a' } });
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('returns 404 when deleting a transaction that does not exist for the user', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue(null);

    const response = await deleteTransaction(
      request('DELETE', '/api/transactions/delete/tx-missing'),
      { params: { id: 'tx-missing' } },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Transaction not found');
    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
  });

  it('creates manual transactions with a required name', async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-manual', name: 'Manual income', sourceType: 'manual' });

    const response = await createTransaction(request('POST', '/api/transactions/create', 'user-a', {
      name: 'Manual income',
      amount: 100,
      type: 'INCOME',
      status: 'COMPLETED',
      date: '2026-05-01',
      sourceType: 'manual',
      categoryId: 'CLIENT',
    }));

    expect(response.status).toBe(201);
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Manual income', userId: 'user-a' }),
    }));
  });

  it('returns 400 when manual transaction name is missing', async () => {
    const response = await createTransaction(request('POST', '/api/transactions/create', 'user-a', {
      amount: 100,
      type: 'INCOME',
      status: 'COMPLETED',
      date: '2026-05-01',
      sourceType: 'manual',
      categoryId: 'CLIENT',
    }));

    expect(response.status).toBe(400);
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });

  it('records a one-time client payment as income when the client is created', async () => {
    const created = { id: 'client-1', name: 'Acme', revenue: 122, status: 'ACTIVE', paymentType: 'onetime', paymentDate: new Date('2026-06-05T12:00:00Z'), billingDay: null, nextBillingDate: null, archivedAt: null };
    mockPrisma.client.create.mockResolvedValue(created);
    mockPrisma.transaction.findUnique.mockResolvedValue(null);
    mockPrisma.transaction.upsert.mockResolvedValue({ id: 'auto-client-onetime-client-1' });
    mockPrisma.client.findUniqueOrThrow.mockResolvedValue(created);

    const response = await createClient(
      request('POST', '/api/clients/create', 'user-a', {
        name: 'Acme', revenue: 122, paymentType: 'onetime', paymentDate: '2026-06-05', clientType: 'INDIVIDUAL', status: 'ACTIVE',
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.transaction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'auto-client-onetime-client-1' },
      create: expect.objectContaining({ amount: 122, type: 'INCOME', categoryId: 'CLIENT', clientId: 'client-1' }),
    }));
  });

  it('does not record an income transaction for a retainer client on create', async () => {
    const created = { id: 'client-2', name: 'Globex', revenue: 500, status: 'ACTIVE', paymentType: 'retainer', paymentDate: null, billingDay: 1, nextBillingDate: new Date('2026-07-01T12:00:00Z'), archivedAt: null };
    mockPrisma.client.create.mockResolvedValue(created);
    mockPrisma.transaction.findUnique.mockResolvedValue(null);
    mockPrisma.client.findUniqueOrThrow.mockResolvedValue(created);

    const response = await createClient(
      request('POST', '/api/clients/create', 'user-a', {
        name: 'Globex', revenue: 500, paymentType: 'retainer', nextBillingDate: '2026-07-01', clientType: 'COMPANY', status: 'ACTIVE',
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.transaction.upsert).not.toHaveBeenCalled();
  });

  it('updates client billing settings without touching historical transactions', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-a', userId: 'user-a' });
    mockPrisma.client.update.mockResolvedValue({ id: 'client-a', name: 'Updated', revenue: 200, userId: 'user-a' });

    const response = await updateClient(
      request('PUT', '/api/clients/update/client-a', 'user-a', {
        name: 'Updated',
        revenue: 200,
        nextBillingDate: '2026-06-01',
        paymentType: 'retainer',
        clientType: 'INDIVIDUAL',
        status: 'ACTIVE',
      }),
      { params: { id: 'client-a' } },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
  });

  it('updates subscription billing settings without touching historical transactions', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-a', userId: 'user-a' });
    mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-a', name: 'Tool Pro', amount: 99, billingCycle: 'YEARLY', cycle: 'YEARLY', userId: 'user-a' });

    const response = await updateSubscription(
      request('PUT', '/api/subscriptions/update/sub-a', 'user-a', {
        name: 'Tool Pro',
        amount: 99,
        billingCycle: 'YEARLY',
        nextBillingDate: '2026-12-01',
        status: 'ACTIVE',
      }),
      { params: { id: 'sub-a' } },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 400 validation errors for invalid client update payloads', async () => {
    const response = await updateClient(
      request('PUT', '/api/clients/update/client-a', 'user-a', { nextBillingDate: 'not-a-date' }),
      { params: { id: 'client-a' } },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('returns 400 validation errors for invalid subscription update payloads', async () => {
    const response = await updateSubscription(
      request('PUT', '/api/subscriptions/update/sub-a', 'user-a', { amount: -10 }),
      { params: { id: 'sub-a' } },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('restores an archived client to active status', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-a', userId: 'user-a', archivedAt: new Date() });
    mockPrisma.client.update.mockResolvedValue({ id: 'client-a', userId: 'user-a', status: 'ACTIVE', archivedAt: null });

    const response = await restoreClient(
      request('PATCH', '/api/clients/restore/client-a'),
      { params: { id: 'client-a' } },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ACTIVE');
    expect(body.archivedAt).toBeNull();
    expect(mockPrisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-a' },
      data: { status: 'ACTIVE', archivedAt: null },
    });
  });

  it('returns 400 when restoring a client that is not archived', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-a', userId: 'user-a', archivedAt: null });

    const response = await restoreClient(
      request('PATCH', '/api/clients/restore/client-a'),
      { params: { id: 'client-a' } },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('prevents restoring another user archived client', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    const response = await restoreClient(
      request('PATCH', '/api/clients/restore/client-b'),
      { params: { id: 'client-b' } },
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('restores an archived subscription to active status', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-a', userId: 'user-a', archivedAt: new Date() });
    mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-a', userId: 'user-a', status: 'ACTIVE', archivedAt: null });

    const response = await restoreSubscription(
      request('PATCH', '/api/subscriptions/restore/sub-a'),
      { params: { id: 'sub-a' } },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ACTIVE');
    expect(body.archivedAt).toBeNull();
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-a' },
      data: { status: 'ACTIVE', archivedAt: null },
    });
  });

  it('returns 400 when restoring a subscription that is not archived', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-a', userId: 'user-a', archivedAt: null });

    const response = await restoreSubscription(
      request('PATCH', '/api/subscriptions/restore/sub-a'),
      { params: { id: 'sub-a' } },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('prevents restoring another user archived subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);

    const response = await restoreSubscription(
      request('PATCH', '/api/subscriptions/restore/sub-b'),
      { params: { id: 'sub-b' } },
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('archived client historical transactions remain after archive', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-a', userId: 'user-a' });
    mockPrisma.client.update.mockResolvedValue({ id: 'client-a', userId: 'user-a', status: 'INACTIVE', archivedAt: new Date() });

    await deleteClient(
      request('DELETE', '/api/clients/delete/client-a'),
      { params: { id: 'client-a' } },
    );

    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('archived subscription historical transactions remain after archive', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-a', userId: 'user-a' });
    mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-a', userId: 'user-a', status: 'INACTIVE', archivedAt: new Date() });

    await deleteSubscription(
      request('DELETE', '/api/subscriptions/delete/sub-a'),
      { params: { id: 'sub-a' } },
    );

    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled();
  });
});
