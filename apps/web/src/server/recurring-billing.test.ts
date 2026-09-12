import {
  recordClientPayment,
  recordSubscriptionPayment,
  runDueRecurringPaymentsInTransaction,
  createPendingPayment,
  updatePendingPayment,
  deletePendingPayment,
  completePendingPayment,
  revertPendingPayment,
} from './recurring-billing';

type MockRow = Record<string, any>;
type MockWhere = Record<string, any>;

const makeTx = () => {
  const clients: MockRow[] = [];
  const subscriptions: MockRow[] = [];
  const transactions: MockRow[] = [];

  const matchesWhere = (item: MockRow, where: MockWhere): boolean => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return (value as MockWhere[]).some((clause) => matchesWhere(item, clause));
    if (value && typeof value === 'object' && 'lte' in value) return item[key] <= (value as { lte: any }).lte;
    if (value === null) return item[key] === null || item[key] === undefined;
    return item[key] === value;
  });

  return {
    clients,
    subscriptions,
    transactions,
    tx: {
      client: {
        findFirst: jest.fn(({ where }) => Promise.resolve(clients.find((item) => matchesWhere(item, where)) || null)),
        findMany: jest.fn(({ where }) => Promise.resolve(clients.filter((item) => matchesWhere(item, where)))),
        update: jest.fn(({ where, data }) => {
          const item = clients.find((client) => client.id === where.id);
          Object.assign(item!, data);
          return Promise.resolve(item!);
        }),
      },
      subscription: {
        findFirst: jest.fn(({ where }) => Promise.resolve(subscriptions.find((item) => matchesWhere(item, where)) || null)),
        findMany: jest.fn(({ where }) => Promise.resolve(subscriptions.filter((item) => matchesWhere(item, where)))),
        update: jest.fn(({ where, data }) => {
          const item = subscriptions.find((subscription) => subscription.id === where.id);
          Object.assign(item!, data);
          return Promise.resolve(item!);
        }),
      },
      transaction: {
        findFirst: jest.fn(({ where }) => Promise.resolve(transactions.find((item) => matchesWhere(item, where)) || null)),
        findFirstOrThrow: jest.fn(({ where }) => {
          const item = transactions.find((transaction) => matchesWhere(transaction, where));
          if (!item) throw new Error('not found');
          return Promise.resolve(item);
        }),
        create: jest.fn(({ data }) => {
          const row = { id: data.id || `tx-${Date.now()}`, ...data };
          transactions.push(row);
          return Promise.resolve(row);
        }),
        update: jest.fn(({ where, data }) => {
          const item = transactions.find((transaction) => transaction.id === where.id);
          if (!item) throw new Error('not found');
          Object.assign(item, data);
          return Promise.resolve(item);
        }),
        delete: jest.fn(({ where }) => {
          const index = transactions.findIndex((transaction) => transaction.id === where.id);
          if (index === -1) throw new Error('not found');
          const [removed] = transactions.splice(index, 1);
          return Promise.resolve(removed);
        }),
      },
    } as any,
  };
};

describe('recurring billing', () => {
  it('records a client retainer payment and advances one month', async () => {
    const state = makeTx();
    state.clients.push({ id: 'client-1', userId: 'user-a', name: 'Acme', revenue: 100, status: 'ACTIVE', paymentType: 'retainer', nextBillingDate: new Date('2026-05-01T12:00:00.000Z'), archivedAt: null });

    const result = await recordClientPayment(state.tx, 'user-a', 'client-1', new Date('2026-05-25T12:00:00.000Z'));

    expect(result.transaction).toEqual(expect.objectContaining({
      name: 'Acme retainer payment',
      amount: 100,
      type: 'INCOME',
      sourceType: 'client',
      sourceId: 'client-1',
      clientId: 'client-1',
    }));
    expect(result.transaction.sourceBillingDate!.toISOString().slice(0, 10)).toBe('2026-05-01');
    expect(result.client.nextBillingDate!.toISOString().slice(0, 10)).toBe('2026-06-01');
  });

  it('records a subscription payment and advances by billing cycle', async () => {
    const state = makeTx();
    state.subscriptions.push({ id: 'sub-1', userId: 'user-a', name: 'Tool', amount: 30, status: 'ACTIVE', cycle: 'QUARTERLY', billingCycle: 'QUARTERLY', nextBillingDate: new Date('2026-05-01T12:00:00.000Z'), archivedAt: null });

    const result = await recordSubscriptionPayment(state.tx, 'user-a', 'sub-1', new Date('2026-05-25T12:00:00.000Z'));

    expect(result.transaction).toEqual(expect.objectContaining({
      name: 'Tool subscription payment',
      amount: 30,
      type: 'EXPENSE',
      sourceType: 'subscription',
      sourceId: 'sub-1',
      subscriptionId: 'sub-1',
    }));
    expect(result.subscription.nextBillingDate.toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('runDueRecurringPayments is idempotent for existing source billing dates', async () => {
    const state = makeTx();
    const dueDate = new Date('2026-05-01T12:00:00.000Z');
    state.clients.push({ id: 'client-1', userId: 'user-a', name: 'Acme', revenue: 100, status: 'ACTIVE', paymentType: 'retainer', nextBillingDate: dueDate, archivedAt: null });

    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-05-25T12:00:00.000Z'));
    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-05-25T12:00:00.000Z'));

    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].sourceBillingDate.toISOString().slice(0, 10)).toBe('2026-05-01');
    expect(state.clients[0].nextBillingDate.toISOString().slice(0, 10)).toBe('2026-06-01');
  });

  it('skips removed (archived) clients when running due recurring payments', async () => {
    const state = makeTx();
    const dueDate = new Date('2026-05-01T12:00:00.000Z');
    state.clients.push({
      id: 'client-removed',
      userId: 'user-a',
      name: 'Old Acme',
      revenue: 100,
      status: 'ACTIVE',
      paymentType: 'retainer',
      nextBillingDate: dueDate,
      archivedAt: new Date('2026-04-15T12:00:00.000Z'),
    });

    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-05-25T12:00:00.000Z'));

    expect(state.transactions).toHaveLength(0);
    expect(state.clients[0].nextBillingDate.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('skips removed (archived) subscriptions when running due recurring payments', async () => {
    const state = makeTx();
    const dueDate = new Date('2026-05-01T12:00:00.000Z');
    state.subscriptions.push({
      id: 'sub-removed',
      userId: 'user-a',
      name: 'Legacy Tool',
      amount: 25,
      status: 'ACTIVE',
      cycle: 'MONTHLY',
      billingCycle: 'MONTHLY',
      nextBillingDate: dueDate,
      archivedAt: new Date('2026-04-20T12:00:00.000Z'),
    });

    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-05-25T12:00:00.000Z'));

    expect(state.transactions).toHaveLength(0);
    expect(state.subscriptions[0].nextBillingDate.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('client recurring billing creates PENDING transactions with expectedDate, while subscriptions create COMPLETED', async () => {
    const state = makeTx();
    const dueDate = new Date('2026-05-01T12:00:00.000Z');
    state.clients.push({ id: 'client-1', userId: 'user-a', name: 'Acme', revenue: 100, status: 'ACTIVE', paymentType: 'retainer', nextBillingDate: dueDate, archivedAt: null });
    state.subscriptions.push({ id: 'sub-1', userId: 'user-a', name: 'Tool', amount: 30, status: 'ACTIVE', cycle: 'MONTHLY', billingCycle: 'MONTHLY', nextBillingDate: dueDate, archivedAt: null });

    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-05-25T12:00:00.000Z'));

    const clientTx = state.transactions.find((t) => t.sourceType === 'client');
    const subTx = state.transactions.find((t) => t.sourceType === 'subscription');

    expect(clientTx!.status).toBe('PENDING');
    expect(clientTx!.expectedDate!.toISOString().slice(0, 10)).toBe('2026-05-01');

    expect(subTx!.status).toBe('COMPLETED');
  });

  it('supports the full pending payment lifecycle: create, update, complete, and revert', async () => {
    const state = makeTx();
    state.clients.push({ id: 'client-1', userId: 'user-a', name: 'Acme', revenue: 500, status: 'ACTIVE', paymentType: 'retainer', nextBillingDate: new Date('2026-05-01T12:00:00.000Z'), archivedAt: null });

    // 1. Create
    const created = await createPendingPayment(state.tx, 'user-a', {
      clientId: 'client-1',
      amount: 500,
      expectedDate: '2026-06-01',
      note: 'Initial pending payment',
    });

    expect(created.status).toBe('PENDING');
    expect(created.amount).toBe(500);
    expect(created.name).toBe('Acme payment');
    expect(created.expectedDate!.toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(created.date.toISOString().slice(0, 10)).toBe('2026-06-01');

    // 2. Update amount and expectedDate
    const updated = await updatePendingPayment(state.tx, 'user-a', created.id, {
      amount: 600,
      expectedDate: '2026-06-05',
    });
    expect(updated.amount).toBe(600);
    expect(updated.date.toISOString().slice(0, 10)).toBe('2026-06-05');
    expect(updated.expectedDate!.toISOString().slice(0, 10)).toBe('2026-06-05');

    // 3. Complete (mark as paid)
    const completed = await completePendingPayment(state.tx, 'user-a', created.id, '2026-06-08');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.date.toISOString().slice(0, 10)).toBe('2026-06-08');
    expect(completed.expectedDate!.toISOString().slice(0, 10)).toBe('2026-06-05'); // preserved
    expect(completed.completedAt).toBeInstanceOf(Date);

    // Double-complete should be rejected with 409
    await expect(completePendingPayment(state.tx, 'user-a', created.id)).rejects.toThrow('Payment is not pending');

    // 4. Revert back to pending
    const reverted = await revertPendingPayment(state.tx, 'user-a', created.id);
    expect(reverted.status).toBe('PENDING');
    expect(reverted.date.toISOString().slice(0, 10)).toBe('2026-06-05');
    expect(reverted.completedAt).toBeNull();

    // 5. Delete pending payment
    const delResult = await deletePendingPayment(state.tx, 'user-a', created.id);
    expect(delResult).toEqual({ success: true });
    expect(state.transactions).toHaveLength(0);
  });

  it('completing January pending payment with completion date on February billing date succeeds without collision', async () => {
    const state = makeTx();
    state.clients.push({
      id: 'client-1',
      userId: 'user-a',
      name: 'Acme',
      revenue: 500,
      status: 'ACTIVE',
      paymentType: 'retainer',
      nextBillingDate: new Date('2026-01-01T12:00:00.000Z'),
      archivedAt: null,
    });

    // Jan 1: recurring run creates January pending payment
    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-01-01T12:00:00.000Z'));
    expect(state.transactions).toHaveLength(1);
    const rowA = state.transactions[0];
    expect(rowA.sourceBillingDate.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(rowA.status).toBe('PENDING');

    // Feb 1: recurring run creates February pending payment
    await runDueRecurringPaymentsInTransaction(state.tx, 'user-a', new Date('2026-02-01T12:00:00.000Z'));
    expect(state.transactions).toHaveLength(2);

    // Freelancer confirms receipt of January payment on Feb 1 (completion date = Feb 1)
    const completedA = await completePendingPayment(state.tx, 'user-a', rowA.id, '2026-02-01');
    expect(completedA.status).toBe('COMPLETED');
    expect(completedA.date.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(completedA.sourceBillingDate!.toISOString().slice(0, 10)).toBe('2026-01-01');

    // Both rows still exist with correct amounts and statuses
    expect(state.transactions).toHaveLength(2);
    const updatedA = state.transactions.find((t) => t.id === rowA.id)!;
    const currentB = state.transactions.find((t) => t.id !== rowA.id)!;

    expect(updatedA.status).toBe('COMPLETED');
    expect(updatedA.amount).toBe(500);
    expect(updatedA.date.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(updatedA.sourceBillingDate.toISOString().slice(0, 10)).toBe('2026-01-01');

    expect(currentB.status).toBe('PENDING');
    expect(currentB.amount).toBe(500);
    expect(currentB.date.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(currentB.sourceBillingDate.toISOString().slice(0, 10)).toBe('2026-02-01');
  });
});
