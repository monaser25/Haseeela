const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  client: {
    findFirst: jest.fn(),
  },
  invoice: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  invoiceLineItem: {
    deleteMany: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  accountDeletion: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/server/prisma', () => ({ prisma: mockPrisma }));

import { POST as createInvoice } from '@/app/api/invoices/create/route';
import { PUT as updateInvoice } from '@/app/api/invoices/update/[id]/route';
import { POST as markPaid } from '@/app/api/invoices/[id]/mark-paid/route';

interface DBClient {
  id: string;
  name: string;
  userId: string;
}

interface DBLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  position: number;
}

interface DBInvoice {
  id: string;
  number: string;
  clientId: string | null;
  userId: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  sentAt: Date | null;
  paidAt: Date | null;
  transactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DBTransaction {
  id: string;
  name: string;
  amount: number;
  type: string;
  status: string;
  date: Date;
  notes: string | null;
  sourceType: string;
  sourceId: string | null;
  categoryId: string;
  clientId: string | null;
  isAuto: boolean;
  userId: string;
  createdAt: Date;
}

interface DBNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  refKey: string | null;
  userId: string;
}

interface DBState {
  users: Map<string, { id: string; name: string; email: string }>;
  clients: Map<string, DBClient>;
  invoices: Map<string, DBInvoice>;
  lineItems: Map<string, DBLineItem[]>;
  transactions: Map<string, DBTransaction>;
  notifications: DBNotification[];
}

const createInitialState = (): DBState => ({
  users: new Map([
    ['user-a', { id: 'user-a', name: 'User A', email: 'user-a@flowledger.local' }],
    ['user-b', { id: 'user-b', name: 'User B', email: 'user-b@flowledger.local' }],
  ]),
  clients: new Map([
    ['client-a', { id: 'client-a', name: 'Client A', userId: 'user-a' }],
    ['client-b', { id: 'client-b', name: 'Client B', userId: 'user-b' }],
  ]),
  invoices: new Map(),
  lineItems: new Map(),
  transactions: new Map(),
  notifications: [],
});

let dbState: DBState = createInitialState();

const cloneState = (s: DBState): DBState => ({
  users: new Map(Array.from(s.users.entries()).map(([k, v]) => [k, { ...v }])),
  clients: new Map(Array.from(s.clients.entries()).map(([k, v]) => [k, { ...v }])),
  invoices: new Map(Array.from(s.invoices.entries()).map(([k, v]) => [k, { ...v }])),
  lineItems: new Map(Array.from(s.lineItems.entries()).map(([k, v]) => [k, v.map(item => ({ ...item }))])),
  transactions: new Map(Array.from(s.transactions.entries()).map(([k, v]) => [k, { ...v }])),
  notifications: s.notifications.map(n => ({ ...n })),
});

const restoreState = (target: DBState, source: DBState) => {
  target.users = new Map(source.users);
  target.clients = new Map(source.clients);
  target.invoices = new Map(source.invoices);
  target.lineItems = new Map(source.lineItems);
  target.transactions = new Map(source.transactions);
  target.notifications = [...source.notifications];
};

const hooks = {
  onInvoiceFindFirst: null as ((where: any) => Promise<void>) | null,
  beforeUpdateMany: null as (() => Promise<void>) | null,
  failTransactionCreate: false,
};

const formatInvoice = (inv: DBInvoice, s: DBState, include?: any) => {
  const result: any = { ...inv };
  if (include?.lineItems) {
    const items = s.lineItems.get(inv.id) || [];
    result.lineItems = items.map(li => ({ ...li })).sort((a, b) => a.position - b.position);
  }
  if (include?.client) {
    const cl = inv.clientId ? s.clients.get(inv.clientId) : null;
    result.client = cl ? { id: cl.id, name: cl.name } : null;
  }
  return result;
};

const buildClientMethods = (s: DBState) => ({
  findFirst: jest.fn(async ({ where }: any) => {
    for (const c of Array.from(s.clients.values())) {
      if (where.id && c.id !== where.id) continue;
      if (where.userId && c.userId !== where.userId) continue;
      return { ...c };
    }
    return null;
  }),
});

const buildInvoiceMethods = (s: DBState) => ({
  count: jest.fn(async ({ where }: any) => {
    let count = 0;
    for (const inv of Array.from(s.invoices.values())) {
      if (where?.userId && inv.userId !== where.userId) continue;
      count++;
    }
    return count;
  }),
  findFirst: jest.fn(async ({ where, include }: any) => {
    if (hooks.onInvoiceFindFirst) {
      await hooks.onInvoiceFindFirst(where);
    }
    for (const inv of Array.from(s.invoices.values())) {
      if (where.id && inv.id !== where.id) continue;
      if (where.userId && inv.userId !== where.userId) continue;
      if (where.number && inv.number !== where.number) continue;
      return formatInvoice(inv, s, include);
    }
    return null;
  }),
  findUnique: jest.fn(async ({ where, include }: any) => {
    const inv = s.invoices.get(where.id);
    return inv ? formatInvoice(inv, s, include) : null;
  }),
  findUniqueOrThrow: jest.fn(async ({ where, include }: any) => {
    const inv = s.invoices.get(where.id);
    if (!inv) throw new Error('Invoice not found');
    return formatInvoice(inv, s, include);
  }),
  create: jest.fn(async ({ data, include }: any) => {
    const id = data.id || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lineItemInputs = data.lineItems?.create || [];
    const items: DBLineItem[] = lineItemInputs.map((li: any, i: number) => ({
      id: `li-${id}-${i}`,
      invoiceId: id,
      description: li.description,
      quantity: li.quantity,
      rate: li.rate,
      amount: li.amount,
      position: li.position ?? i,
    }));
    s.lineItems.set(id, items);

    const now = new Date();
    const invoice: DBInvoice = {
      id,
      number: data.number,
      clientId: data.clientId || null,
      userId: data.userId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      status: data.status || 'DRAFT',
      currency: data.currency || 'USD',
      subtotal: data.subtotal || 0,
      taxRate: data.taxRate || 0,
      taxAmount: data.taxAmount || 0,
      discount: data.discount || 0,
      total: data.total || 0,
      notes: data.notes || null,
      terms: data.terms || null,
      sentAt: data.sentAt || null,
      paidAt: data.paidAt || null,
      transactionId: data.transactionId || null,
      createdAt: now,
      updatedAt: now,
    };
    s.invoices.set(id, invoice);
    return formatInvoice(invoice, s, include);
  }),
  update: jest.fn(async ({ where, data, include }: any) => {
    const inv = s.invoices.get(where.id);
    if (!inv) throw new Error('Invoice not found to update');

    if (data.lineItems?.create) {
      const lineItemInputs = data.lineItems.create;
      const items: DBLineItem[] = lineItemInputs.map((li: any, i: number) => ({
        id: `li-${inv.id}-${i}`,
        invoiceId: inv.id,
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        amount: li.amount,
        position: li.position ?? i,
      }));
      s.lineItems.set(inv.id, items);
    }

    if (data.number !== undefined) inv.number = data.number;
    if (data.clientId !== undefined) inv.clientId = data.clientId;
    if (data.issueDate !== undefined) inv.issueDate = data.issueDate;
    if (data.dueDate !== undefined) inv.dueDate = data.dueDate;
    if (data.status !== undefined) inv.status = data.status;
    if (data.currency !== undefined) inv.currency = data.currency;
    if (data.subtotal !== undefined) inv.subtotal = data.subtotal;
    if (data.taxRate !== undefined) inv.taxRate = data.taxRate;
    if (data.taxAmount !== undefined) inv.taxAmount = data.taxAmount;
    if (data.discount !== undefined) inv.discount = data.discount;
    if (data.total !== undefined) inv.total = data.total;
    if (data.notes !== undefined) inv.notes = data.notes;
    if (data.terms !== undefined) inv.terms = data.terms;
    if (data.sentAt !== undefined) inv.sentAt = data.sentAt;
    if (data.paidAt !== undefined) inv.paidAt = data.paidAt;
    if (data.transactionId !== undefined) inv.transactionId = data.transactionId;
    inv.updatedAt = new Date();

    return formatInvoice(inv, s, include);
  }),
  updateMany: jest.fn(async ({ where, data }: any) => {
    if (hooks.beforeUpdateMany) {
      await hooks.beforeUpdateMany();
    }
    let count = 0;
    for (const inv of Array.from(s.invoices.values())) {
      if (where.id && inv.id !== where.id) continue;
      if (where.userId && inv.userId !== where.userId) continue;
      if (where.status !== undefined) {
        if (typeof where.status === 'object' && where.status !== null) {
          if (where.status.not !== undefined && inv.status === where.status.not) continue;
        } else if (inv.status !== where.status) {
          continue;
        }
      }

      if (data.status !== undefined) inv.status = data.status;
      if (data.paidAt !== undefined) inv.paidAt = data.paidAt;
      if (data.transactionId !== undefined) inv.transactionId = data.transactionId;
      inv.updatedAt = new Date();
      count++;
    }
    return { count };
  }),
});

const buildInvoiceLineItemMethods = (s: DBState) => ({
  deleteMany: jest.fn(async ({ where }: any) => {
    if (where.invoiceId) {
      const before = s.lineItems.get(where.invoiceId)?.length || 0;
      s.lineItems.delete(where.invoiceId);
      return { count: before };
    }
    return { count: 0 };
  }),
});

const buildTransactionMethods = (s: DBState) => ({
  create: jest.fn(async ({ data }: any) => {
    if (hooks.failTransactionCreate) {
      throw new Error('Simulated transaction create failure');
    }
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tx: DBTransaction = {
      id,
      name: data.name,
      amount: data.amount,
      type: data.type,
      status: data.status,
      date: data.date,
      notes: data.notes || null,
      sourceType: data.sourceType,
      sourceId: data.sourceId || null,
      categoryId: data.categoryId,
      clientId: data.clientId || null,
      isAuto: Boolean(data.isAuto),
      userId: data.userId,
      createdAt: new Date(),
    };
    s.transactions.set(id, tx);
    return { ...tx };
  }),
});

const buildNotificationMethods = (s: DBState) => ({
  create: jest.fn(async ({ data }: any) => {
    const notif: DBNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: data.type,
      title: data.title,
      body: data.body || null,
      link: data.link || null,
      refKey: data.refKey || null,
      userId: data.userId,
    };
    s.notifications.push(notif);
    return { ...notif };
  }),
});

const buildUserMethods = (s: DBState) => ({
  findUnique: jest.fn(async ({ where }: any) => {
    if (where.id) return s.users.get(where.id) || null;
    return null;
  }),
  create: jest.fn(async ({ data }: any) => {
    s.users.set(data.id, { ...data });
    return { ...data };
  }),
  update: jest.fn(async ({ where, data }: any) => {
    const u = s.users.get(where.id);
    if (u) Object.assign(u, data);
    return u ? { ...u } : null;
  }),
});

const setupPrismaDelegates = (s: DBState) => {
  mockPrisma.user = buildUserMethods(s);
  mockPrisma.client = buildClientMethods(s);
  mockPrisma.invoice = buildInvoiceMethods(s);
  mockPrisma.invoiceLineItem = buildInvoiceLineItemMethods(s);
  mockPrisma.transaction = buildTransactionMethods(s);
  mockPrisma.notification = buildNotificationMethods(s);
  mockPrisma.$transaction = jest.fn(async (callback: any) => {
    const snapshot = cloneState(s);
    const txMock: any = {
      user: buildUserMethods(s),
      client: buildClientMethods(s),
      invoice: buildInvoiceMethods(s),
      invoiceLineItem: buildInvoiceLineItemMethods(s),
      transaction: buildTransactionMethods(s),
      notification: buildNotificationMethods(s),
    };
    try {
      return await callback(txMock);
    } catch (err) {
      restoreState(s, snapshot);
      throw err;
    }
  });
};

const tokenFor = (id: string) => `flowledger-dev:${encodeURIComponent(JSON.stringify({ id, email: `${id}@example.com` }))}`;

const request = (method: string, path: string, userId = 'user-a', body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokenFor(userId)}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const validPayload = (overrides: Record<string, any> = {}) => ({
  issueDate: '2025-01-01',
  dueDate: '2025-01-15',
  currency: 'USD',
  lineItems: [{ description: 'Development work', quantity: 2, rate: 100 }],
  ...overrides,
});

describe('Invoice Route Handlers Security and Concurrency', () => {
  const originalEnv = process.env.ENABLE_DEV_AUTH;

  beforeEach(() => {
    process.env.ENABLE_DEV_AUTH = 'true';
    dbState = createInitialState();
    hooks.onInvoiceFindFirst = null;
    hooks.beforeUpdateMany = null;
    hooks.failTransactionCreate = false;

    setupPrismaDelegates(dbState);
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.ENABLE_DEV_AUTH = originalEnv;
    } else {
      delete process.env.ENABLE_DEV_AUTH;
    }
  });

  describe('Invoice Create Client Ownership', () => {
    it.each([
      ['foreign client', 'client-b'],
      ['missing client', 'missing-client'],
    ])('rejects invoice creation with %s (returns 404 Client not found without mutations)', async (_, clientId) => {
      const initialInvoiceCount = dbState.invoices.size;
      const initialLineItemCount = dbState.lineItems.size;

      const res = await createInvoice(
        request('POST', '/api/invoices/create', 'user-a', validPayload({ clientId })),
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Client not found' });
      expect(dbState.invoices.size).toBe(initialInvoiceCount);
      expect(dbState.lineItems.size).toBe(initialLineItemCount);
    });

    it('allows invoice creation with owned client', async () => {
      const res = await createInvoice(
        request('POST', '/api/invoices/create', 'user-a', validPayload({ clientId: 'client-a' })),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.clientId).toBe('client-a');
      expect(dbState.invoices.size).toBe(1);
    });

    it('allows invoice creation with null or omitted client', async () => {
      const res = await createInvoice(
        request('POST', '/api/invoices/create', 'user-a', validPayload({ clientId: null })),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.clientId).toBeNull();
      expect(dbState.invoices.size).toBe(1);
    });
  });

  describe('Invoice Update Ownership & Client Verification', () => {
    beforeEach(() => {
      dbState.invoices.set('inv-a1', {
        id: 'inv-a1',
        number: 'INV-0001',
        clientId: 'client-a',
        userId: 'user-a',
        issueDate: new Date('2025-01-01'),
        dueDate: new Date('2025-01-15'),
        status: 'DRAFT',
        currency: 'USD',
        subtotal: 200,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        total: 200,
        notes: null,
        terms: null,
        sentAt: null,
        paidAt: null,
        transactionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      dbState.lineItems.set('inv-a1', [
        {
          id: 'li-1',
          invoiceId: 'inv-a1',
          description: 'Dev',
          quantity: 2,
          rate: 100,
          amount: 200,
          position: 0,
        },
      ]);
    });

    it('rejects updating another user invoice with 404 and makes no mutations', async () => {
      const initialItems = [...(dbState.lineItems.get('inv-a1') || [])];

      const res = await updateInvoice(
        request('PUT', '/api/invoices/update/inv-a1', 'user-b', validPayload({ number: 'INV-HACK' })),
        { params: { id: 'inv-a1' } },
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Invoice not found' });
      expect(dbState.invoices.get('inv-a1')?.number).toBe('INV-0001');
      expect(dbState.lineItems.get('inv-a1')).toEqual(initialItems);
    });

    it.each([
      ['foreign client', 'client-b'],
      ['missing client', 'missing-client'],
    ])('rejects updating invoice with %s (returns 404 Client not found without mutations)', async (_, clientId) => {
      const initialItems = [...(dbState.lineItems.get('inv-a1') || [])];

      const res = await updateInvoice(
        request('PUT', '/api/invoices/update/inv-a1', 'user-a', validPayload({ clientId })),
        { params: { id: 'inv-a1' } },
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Client not found' });
      expect(dbState.invoices.get('inv-a1')?.clientId).toBe('client-a');
      expect(dbState.lineItems.get('inv-a1')).toEqual(initialItems);
    });

    it('allows updating invoice with owned client or null client', async () => {
      const res = await updateInvoice(
        request('PUT', '/api/invoices/update/inv-a1', 'user-a', validPayload({ clientId: null, notes: 'Updated notes' })),
        { params: { id: 'inv-a1' } },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.clientId).toBeNull();
      expect(body.notes).toBe('Updated notes');
      expect(dbState.invoices.get('inv-a1')?.clientId).toBeNull();
    });
  });

  describe('Invoice Mark-Paid Concurrency & Atomicity', () => {
    beforeEach(() => {
      dbState.invoices.set('inv-paid-1', {
        id: 'inv-paid-1',
        number: 'INV-0010',
        clientId: 'client-a',
        userId: 'user-a',
        issueDate: new Date('2025-01-01'),
        dueDate: new Date('2025-01-15'),
        status: 'SENT',
        currency: 'USD',
        subtotal: 500,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        total: 500,
        notes: null,
        terms: null,
        sentAt: new Date('2025-01-02'),
        paidAt: null,
        transactionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      dbState.lineItems.set('inv-paid-1', [
        {
          id: 'li-paid-1',
          invoiceId: 'inv-paid-1',
          description: 'Design and Architecture',
          quantity: 5,
          rate: 100,
          amount: 500,
          position: 0,
        },
      ]);
    });

    it('rejects mark-paid for non-existent or unauthorized invoice with 404', async () => {
      const res = await markPaid(
        request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-b'),
        { params: { id: 'inv-paid-1' } },
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'Invoice not found' });
      expect(dbState.transactions.size).toBe(0);
    });

    it('returns idempotent response when invoice is already PAID without creating income', async () => {
      const inv = dbState.invoices.get('inv-paid-1')!;
      inv.status = 'PAID';
      inv.paidAt = new Date();
      inv.transactionId = 'tx-existing-123';

      const res = await markPaid(
        request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-a'),
        { params: { id: 'inv-paid-1' } },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.invoice.status).toBe('PAID');
      expect(body.transaction).toBeNull();
      expect(dbState.transactions.size).toBe(0);
      expect(dbState.notifications.length).toBe(0);
    });

    it('deterministically handles parallel mark-paid calls: exactly one income transaction created and only first notification', async () => {
      let waiting = 0;
      let releaseBarrier: () => void;
      const barrierPromise = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
      });

      hooks.onInvoiceFindFirst = async (where: any) => {
        if (where.id === 'inv-paid-1') {
          waiting++;
          if (waiting >= 2) {
            releaseBarrier();
          }
          await barrierPromise;
        }
      };

      const [res1, res2] = await Promise.all([
        markPaid(request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-a'), { params: { id: 'inv-paid-1' } }),
        markPaid(request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-a'), { params: { id: 'inv-paid-1' } }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();

      const winner = body1.transaction ? body1 : body2;
      const loser = body1.transaction ? body2 : body1;

      expect(winner.transaction).not.toBeNull();
      expect(winner.transaction.amount).toBe(500);
      expect(winner.transaction.type).toBe('INCOME');
      expect(winner.transaction.status).toBe('COMPLETED');
      expect(winner.transaction.sourceType).toBe('invoice');
      expect(winner.transaction.sourceId).toBe('inv-paid-1');
      expect(winner.transaction.categoryId).toBe('CLIENT');
      expect(winner.transaction.clientId).toBe('client-a');
      expect(winner.transaction.isAuto).toBe(true);

      expect(loser.transaction).toBeNull();
      expect(loser.invoice.status).toBe('PAID');
      expect(loser.invoice.transactionId).toBe(winner.transaction.id);

      expect(dbState.transactions.size).toBe(1);
      const createdTx = Array.from(dbState.transactions.values())[0];
      expect(createdTx.id).toBe(winner.transaction.id);

      const finalInvoice = dbState.invoices.get('inv-paid-1')!;
      expect(finalInvoice.status).toBe('PAID');
      expect(finalInvoice.transactionId).toBe(winner.transaction.id);

      expect(dbState.notifications.length).toBe(1);
      expect(dbState.notifications[0].type).toBe('PAYMENT_RECORDED');
    });

    it('reads authoritative fresh total and client under transaction protection instead of stale outside snapshot', async () => {
      let initialObserved = false;
      hooks.onInvoiceFindFirst = async () => {
        initialObserved = true;
      };

      hooks.beforeUpdateMany = async () => {
        expect(initialObserved).toBe(true);
        dbState.clients.set('client-fresh', {
          id: 'client-fresh',
          name: 'Client Fresh',
          userId: 'user-a',
        });
        const row = dbState.invoices.get('inv-paid-1')!;
        row.total = 999;
        row.clientId = 'client-fresh';
      };

      const res = await markPaid(
        request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-a'),
        { params: { id: 'inv-paid-1' } },
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.transaction).not.toBeNull();
      expect(body.transaction.amount).toBe(999);
      expect(body.transaction.clientId).toBe('client-fresh');

      const tx = Array.from(dbState.transactions.values())[0];
      expect(tx.amount).toBe(999);
      expect(tx.clientId).toBe('client-fresh');
    });

    it('rolls back status claim and mutations together if transaction creation fails', async () => {
      let claimOccurredInsideTx = false;
      hooks.beforeUpdateMany = async () => {
        claimOccurredInsideTx = true;
      };
      hooks.failTransactionCreate = true;

      const res = await markPaid(
        request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-a'),
        { params: { id: 'inv-paid-1' } },
      );

      expect(res.status).toBe(500);
      expect(claimOccurredInsideTx).toBe(true);

      const inv = dbState.invoices.get('inv-paid-1')!;
      expect(inv.status).toBe('SENT');
      expect(inv.paidAt).toBeNull();
      expect(inv.transactionId).toBeNull();
      expect(dbState.transactions.size).toBe(0);
      expect(dbState.notifications.length).toBe(0);

      hooks.failTransactionCreate = false;
      const retryRes = await markPaid(
        request('POST', '/api/invoices/inv-paid-1/mark-paid', 'user-a'),
        { params: { id: 'inv-paid-1' } },
      );
      expect(retryRes.status).toBe(200);
      const retryBody = await retryRes.json();
      expect(retryBody.transaction).not.toBeNull();
      expect(retryBody.invoice.status).toBe('PAID');
      expect(dbState.invoices.get('inv-paid-1')!.status).toBe('PAID');
      expect(dbState.transactions.size).toBe(1);
      expect(dbState.notifications.length).toBe(1);
    });
  });
});
