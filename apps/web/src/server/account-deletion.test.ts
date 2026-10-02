import { Prisma } from '@prisma/client';

// Stateful mock store for AccountDeletion and all 11 per-user models
let deletionDb = new Map<string, any>();
let userDb = new Map<string, any>();
let invoiceDb = new Map<string, any>();
let invoiceLineItemDb = new Map<string, any>();
let transactionDb = new Map<string, any>();
let budgetDb = new Map<string, any>();
let subscriptionDb = new Map<string, any>();
let clientDb = new Map<string, any>();
let categoryDb = new Map<string, any>();
let notificationDb = new Map<string, any>();
let auditLogDb = new Map<string, any>();
let deviceTokenDb = new Map<string, any>();

const cloneMap = (map: Map<string, any>) => {
  const c = new Map<string, any>();
  const entries = Array.from(map.entries());
  for (let i = 0; i < entries.length; i++) {
    c.set(entries[i][0], { ...entries[i][1] });
  }
  return c;
};

const mockPrisma: any = {
  accountDeletion: {},
  user: {},
  invoice: {},
  invoiceLineItem: {},
  transaction: {},
  budget: {},
  subscription: {},
  client: {},
  category: {},
  notification: {},
  auditLog: {},
  deviceToken: {},
  $transaction: jest.fn(),
};

const setupDefaultMockPrisma = () => {
  mockPrisma.accountDeletion.findUnique = jest.fn(async ({ where }: any) => {
    const row = deletionDb.get(where.userId);
    return row ? { ...row } : null;
  });

  mockPrisma.accountDeletion.findMany = jest.fn(async (args?: any) => {
    let rows = Array.from(deletionDb.values());
    if (args?.where) {
      const w = args.where;
      const now = new Date();
      rows = rows.filter((r) => {
        if (w.status?.in && !w.status.in.includes(r.status)) return false;
        if (w.attempts?.lt !== undefined && !(r.attempts < w.attempts.lt)) return false;
        if (w.OR) {
          const orMatched = w.OR.some((cond: any) => {
            if ('ownerToken' in cond && cond.ownerToken === null && (r.ownerToken === null || r.ownerToken === undefined)) return true;
            if ('leaseExpiresAt' in cond) {
              if (cond.leaseExpiresAt === null && (r.leaseExpiresAt === null || r.leaseExpiresAt === undefined)) return true;
              if (cond.leaseExpiresAt?.lt && r.leaseExpiresAt && new Date(r.leaseExpiresAt) < now) return true;
            }
            if ('ownerToken' in cond && cond.ownerToken && r.ownerToken === cond.ownerToken) return true;
            return false;
          });
          if (!orMatched) return false;
        }
        return true;
      });
    }
    if (args?.orderBy?.createdAt === 'asc') {
      rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    if (args?.take) rows = rows.slice(0, args.take);
    return rows.map((r) => ({ ...r }));
  });

  mockPrisma.accountDeletion.create = jest.fn(async ({ data }: any) => {
    if (deletionDb.has(data.userId)) {
      const err: any = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      });
      throw err;
    }
    const now = new Date();
    const newRow = {
      id: `del-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      attempts: 0,
      lastErrorCode: null,
      ownerToken: null,
      leaseExpiresAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    deletionDb.set(data.userId, newRow);
    return { ...newRow };
  });

  mockPrisma.accountDeletion.updateMany = jest.fn(async ({ where, data }: any) => {
    let count = 0;
    const entries = Array.from(deletionDb.entries());
    const now = new Date();
    for (let i = 0; i < entries.length; i++) {
      const [uid, row] = entries[i];
      if (where.userId && row.userId !== where.userId) continue;
      if (where.ownerToken && row.ownerToken !== where.ownerToken) continue;
      if (where.status) {
        if (typeof where.status === 'string' && row.status !== where.status) continue;
        if (where.status.not && row.status === where.status.not) continue;
        if (where.status.in && !where.status.in.includes(row.status)) continue;
      }
      if (where.attempts?.lt !== undefined) {
        if (!(row.attempts < where.attempts.lt)) continue;
      }
      if (where.leaseExpiresAt?.gt) {
        if (!row.leaseExpiresAt || new Date(row.leaseExpiresAt) <= where.leaseExpiresAt.gt || new Date(row.leaseExpiresAt) <= now) {
          continue;
        }
      }
      if (where.OR) {
        const orMatched = where.OR.some((cond: any) => {
          if ('ownerToken' in cond && cond.ownerToken === null && (row.ownerToken === null || row.ownerToken === undefined)) return true;
          if ('leaseExpiresAt' in cond) {
            if (cond.leaseExpiresAt === null && (row.leaseExpiresAt === null || row.leaseExpiresAt === undefined)) return true;
            if (cond.leaseExpiresAt?.lt && row.leaseExpiresAt && new Date(row.leaseExpiresAt) < now) return true;
          }
          if ('ownerToken' in cond && cond.ownerToken && row.ownerToken === cond.ownerToken) return true;
          return false;
        });
        if (!orMatched) continue;
      }

      const updated = { ...row, ...data, updatedAt: now };
      if (data.attempts?.increment) {
        updated.attempts = (row.attempts || 0) + data.attempts.increment;
      }
      deletionDb.set(uid, updated);
      count++;
    }
    return { count };
  });

  mockPrisma.user.findUnique = jest.fn(async ({ where }: any) => {
    if (where.id) return userDb.get(where.id) || null;
    if (where.email) {
      const users = Array.from(userDb.values());
      for (let i = 0; i < users.length; i++) {
        if (users[i].email === where.email) return { ...users[i] };
      }
    }
    return null;
  });

  mockPrisma.user.findMany = jest.fn(async () => Array.from(userDb.values()));
  mockPrisma.user.create = jest.fn(async ({ data }: any) => {
    const newUser = { ...data };
    userDb.set(data.id, newUser);
    return newUser;
  });
  mockPrisma.user.update = jest.fn(async ({ where, data }: any) => {
    const u = userDb.get(where.id);
    if (u) {
      Object.assign(u, data);
      return { ...u };
    }
    return null;
  });
  mockPrisma.user.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(userDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (where.id && entries[i][0] === where.id) {
        userDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.invoice.findMany = jest.fn(async ({ where }: any) => {
    const rows = Array.from(invoiceDb.values());
    return rows.filter((r) => !where?.userId || r.userId === where.userId);
  });
  mockPrisma.invoice.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(invoiceDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        invoiceDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.invoiceLineItem.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(invoiceLineItemDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (where?.invoiceId?.in && where.invoiceId.in.includes(entries[i][1].invoiceId)) {
        invoiceLineItemDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.transaction.findMany = jest.fn(async () => Array.from(transactionDb.values()));
  mockPrisma.transaction.findFirst = jest.fn().mockResolvedValue(null);
  mockPrisma.transaction.findUnique = jest.fn().mockResolvedValue(null);
  mockPrisma.transaction.create = jest.fn();
  mockPrisma.transaction.update = jest.fn();
  mockPrisma.transaction.upsert = jest.fn();
  mockPrisma.transaction.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(transactionDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        transactionDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.budget.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(budgetDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        budgetDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.subscription.findMany = jest.fn(async () => Array.from(subscriptionDb.values()));
  mockPrisma.subscription.update = jest.fn().mockResolvedValue({});
  mockPrisma.subscription.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(subscriptionDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        subscriptionDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.client.findMany = jest.fn(async ({ where }: any) => {
    const rows = Array.from(clientDb.values());
    return rows.filter((r) => !where?.userId || r.userId === where.userId);
  });
  mockPrisma.client.update = jest.fn().mockResolvedValue({});
  mockPrisma.client.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(clientDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        clientDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.category.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(categoryDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        categoryDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.notification.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(notificationDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        notificationDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });
  mockPrisma.notification.upsert = jest.fn().mockResolvedValue({ id: 'notif-1' });

  mockPrisma.auditLog.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(auditLogDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        auditLogDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.deviceToken.deleteMany = jest.fn(async ({ where }: any) => {
    let count = 0;
    const entries = Array.from(deviceTokenDb.entries());
    for (let i = 0; i < entries.length; i++) {
      if (!where?.userId || entries[i][1].userId === where.userId) {
        deviceTokenDb.delete(entries[i][0]);
        count++;
      }
    }
    return { count };
  });

  mockPrisma.$transaction = jest.fn(async (callback: any) => {
    const sDel = cloneMap(deletionDb);
    const sUser = cloneMap(userDb);
    const sInv = cloneMap(invoiceDb);
    const sItem = cloneMap(invoiceLineItemDb);
    const sTx = cloneMap(transactionDb);
    const sBud = cloneMap(budgetDb);
    const sSub = cloneMap(subscriptionDb);
    const sCli = cloneMap(clientDb);
    const sCat = cloneMap(categoryDb);
    const sNot = cloneMap(notificationDb);
    const sAud = cloneMap(auditLogDb);
    const sDev = cloneMap(deviceTokenDb);

    try {
      return await callback(mockPrisma);
    } catch (err) {
      deletionDb = sDel;
      userDb = sUser;
      invoiceDb = sInv;
      invoiceLineItemDb = sItem;
      transactionDb = sTx;
      budgetDb = sBud;
      subscriptionDb = sSub;
      clientDb = sCli;
      categoryDb = sCat;
      notificationDb = sNot;
      auditLogDb = sAud;
      deviceTokenDb = sDev;
      throw err;
    }
  });
};

jest.mock('@/server/prisma', () => ({ prisma: mockPrisma }));

const mockSupabaseAdmin = {
  deleteUser: jest.fn(),
  getUserById: jest.fn(),
};

const mockSupabaseAuth = {
  getUser: jest.fn(),
  admin: mockSupabaseAdmin,
};

jest.mock('@/server/supabase', () => ({
  getSupabaseAuthClient: jest.fn(() => ({ auth: mockSupabaseAuth })),
}));

// Real exported handlers under test
import { DELETE as deleteUserAccount } from '@/app/api/user/delete/route';
import { GET as runCron } from '@/app/api/cron/route';
import { ensureUser } from '@/server/devUser';
import { GET as getClients } from '@/app/api/clients/route';
import {
  retryPendingDeletions,
  executeFencedFinancialCleanupTransaction,
  executeAccountDeletionWorkflow,
} from '@/server/accountDeletion';

const tokenFor = (id: string) => `flowledger-dev:${encodeURIComponent(JSON.stringify({ id, email: `${id}@example.com` }))}`;

const request = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const seedUserFinanceData = (userId: string) => {
  userDb.set(userId, { id: userId, email: `${userId}@example.com`, notifyBillingReminders: false, notifyInvoiceDue: false });
  clientDb.set(`client-${userId}`, { id: `client-${userId}`, userId, name: `Client ${userId}` });
  subscriptionDb.set(`sub-${userId}`, { id: `sub-${userId}`, userId, name: `Sub ${userId}` });
  categoryDb.set(`cat-${userId}`, { id: `cat-${userId}`, userId, name: `Cat ${userId}` });
  budgetDb.set(`bud-${userId}`, { id: `bud-${userId}`, userId, categoryId: `cat-${userId}` });
  invoiceDb.set(`inv-${userId}`, { id: `inv-${userId}`, userId, number: `INV-${userId}` });
  invoiceLineItemDb.set(`item-${userId}`, { id: `item-${userId}`, invoiceId: `inv-${userId}`, description: 'Item' });
  transactionDb.set(`tx-${userId}`, { id: `tx-${userId}`, userId, amount: 100 });
  notificationDb.set(`notif-${userId}`, { id: `notif-${userId}`, userId, title: 'Notif' });
  auditLogDb.set(`audit-${userId}`, { id: `audit-${userId}`, userId, action: 'CREATE' });
  deviceTokenDb.set(`dev-${userId}`, { id: `dev-${userId}`, userId, token: `ExponentPushToken[${userId}]` });
};

// All 10 domain tables the deletion transaction cleans (schema.prisma models, in code order).
const DOMAIN_STORES: Array<[string, () => Map<string, any>]> = [
  ['notification', () => notificationDb],
  ['invoiceLineItem', () => invoiceLineItemDb],
  ['invoice', () => invoiceDb],
  ['transaction', () => transactionDb],
  ['budget', () => budgetDb],
  ['subscription', () => subscriptionDb],
  ['client', () => clientDb],
  ['category', () => categoryDb],
  ['auditLog', () => auditLogDb],
  ['user', () => userDb],
];

const snapshotDomainRows = (): Record<string, string[]> =>
  Object.fromEntries(DOMAIN_STORES.map(([name, get]) => [name, Array.from(get().keys()).sort()]));

// Adds `extra` more rows per table for a user (on top of seedUserFinanceData's single row).
const seedExtraRows = (userId: string, extra: number) => {
  for (let n = 2; n < 2 + extra; n++) {
    const sfx = `${userId}-${n}`;
    clientDb.set(`client-${sfx}`, { id: `client-${sfx}`, userId });
    subscriptionDb.set(`sub-${sfx}`, { id: `sub-${sfx}`, userId });
    categoryDb.set(`cat-${sfx}`, { id: `cat-${sfx}`, userId });
    budgetDb.set(`bud-${sfx}`, { id: `bud-${sfx}`, userId });
    invoiceDb.set(`inv-${sfx}`, { id: `inv-${sfx}`, userId });
    invoiceLineItemDb.set(`item-${sfx}`, { id: `item-${sfx}`, invoiceId: `inv-${sfx}` });
    transactionDb.set(`tx-${sfx}`, { id: `tx-${sfx}`, userId });
    notificationDb.set(`notif-${sfx}`, { id: `notif-${sfx}`, userId });
    auditLogDb.set(`audit-${sfx}`, { id: `audit-${sfx}`, userId });
  }
};

const armAuthDeletedRow = (userId: string, ownerToken: string) => {
  deletionDb.set(userId, {
    id: `del-${userId}`,
    userId,
    status: 'AUTH_DELETED',
    isDev: false,
    attempts: 0,
    lastErrorCode: null,
    ownerToken,
    leaseExpiresAt: new Date(Date.now() + 60_000),
    completedAt: null,
  });
};

describe('Production-Safe Account Deletion Lifecycle & Verification Seams', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENABLE_DEV_AUTH = 'true';
    process.env.CRON_SECRET = 'test-cron-secret-123';
    jest.clearAllMocks();

    deletionDb.clear();
    userDb.clear();
    invoiceDb.clear();
    invoiceLineItemDb.clear();
    transactionDb.clear();
    budgetDb.clear();
    subscriptionDb.clear();
    clientDb.clear();
    categoryDb.clear();
    notificationDb.clear();
    auditLogDb.clear();
    deviceTokenDb.clear();

    setupDefaultMockPrisma();

    seedUserFinanceData('user-a');
    seedUserFinanceData('user-b');
    seedUserFinanceData('user-real');

    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-real', email: 'user-real@example.com' } },
      error: null,
    });
    mockSupabaseAdmin.deleteUser.mockResolvedValue({ data: { user: {} }, error: null });
    mockSupabaseAdmin.getUserById.mockResolvedValue({ data: { user: { id: 'user-real' } }, error: null });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. Durable Intent & Null Post-Claim Safety', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await deleteUserAccount(request('DELETE', '/api/user/delete'));
      expect(res.status).toBe(401);
      expect(mockSupabaseAdmin.deleteUser).not.toHaveBeenCalled();
      expect(userDb.has('user-real')).toBe(true);
    });

    it('returns non-200 with deletionPending: false when initial intent persistence fails unexpectedly', async () => {
      mockPrisma.accountDeletion.create.mockRejectedValueOnce(new Error('Prisma database connection failure'));

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({
        error: 'Failed to record account deletion intent',
        code: 'PERSISTENCE_FAILED',
        deletionPending: false,
      });
      expect(mockSupabaseAdmin.deleteUser).not.toHaveBeenCalled();
      expect(userDb.has('user-real')).toBe(true);
    });

    it('returns non-200 and zero irreversible writes if durable row is absent post-claim', async () => {
      let claimAcquired = false;
      const origUpdateMany = mockPrisma.accountDeletion.updateMany;
      mockPrisma.accountDeletion.updateMany = jest.fn(async (args: any) => {
        const res = await origUpdateMany(args);
        if (args?.data?.ownerToken) {
          claimAcquired = true;
        }
        return res;
      });

      const origFindUnique = mockPrisma.accountDeletion.findUnique;
      mockPrisma.accountDeletion.findUnique = jest.fn(async (args: any) => {
        if (claimAcquired) {
          // Immediately after claim is acquired, simulate intent record absent/dropped
          return null;
        }
        return origFindUnique(args);
      });

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.deletionPending).toBe(false);
      expect(mockSupabaseAdmin.deleteUser).not.toHaveBeenCalled();
      expect(userDb.has('user-real')).toBe(true);
    });
  });

  describe('2. Multi-User Scoped Cleanup & Foreign Key Order', () => {
    it('scoped cleanup deletes all owned finance data of target user, leaving other users untouched', async () => {
      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: `Bearer ${tokenFor('user-a')}`,
      }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      expect(userDb.has('user-a')).toBe(false);
      expect(clientDb.has('client-user-a')).toBe(false);
      expect(subscriptionDb.has('sub-user-a')).toBe(false);
      expect(categoryDb.has('cat-user-a')).toBe(false);
      expect(budgetDb.has('bud-user-a')).toBe(false);
      expect(invoiceDb.has('inv-user-a')).toBe(false);
      expect(invoiceLineItemDb.has('item-user-a')).toBe(false);
      expect(transactionDb.has('tx-user-a')).toBe(false);
      expect(notificationDb.has('notif-user-a')).toBe(false);
      expect(auditLogDb.has('audit-user-a')).toBe(false);
      expect(deviceTokenDb.has('dev-user-a')).toBe(false);

      expect(userDb.has('user-b')).toBe(true);
      expect(clientDb.has('client-user-b')).toBe(true);
      expect(subscriptionDb.has('sub-user-b')).toBe(true);
      expect(categoryDb.has('cat-user-b')).toBe(true);
      expect(budgetDb.has('bud-user-b')).toBe(true);
      expect(invoiceDb.has('inv-user-b')).toBe(true);
      expect(invoiceLineItemDb.has('item-user-b')).toBe(true);
      expect(transactionDb.has('tx-user-b')).toBe(true);
      expect(notificationDb.has('notif-user-b')).toBe(true);
      expect(auditLogDb.has('audit-user-b')).toBe(true);
      expect(deviceTokenDb.has('dev-user-b')).toBe(true);
    });
  });

  describe('3. Transaction Rollback & Fenced Cleanup Verification', () => {
    it('rolls back scoped finance cleanup and restores ALL 11 tables when late commit fails after all deletes', async () => {
      const origUpdateMany = mockPrisma.accountDeletion.updateMany;
      mockPrisma.accountDeletion.updateMany = jest.fn(async (args: any) => {
        if (args?.data?.status === 'COMPLETED') {
          throw new Error('Database disk error during final COMPLETED commit');
        }
        return origUpdateMany(args);
      });

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({
        error: 'Failed to clean up account data',
        code: 'FINANCE_CLEANUP_FAILED',
        deletionPending: true,
      });

      // Assert ALL 11 per-user stores rolled back completely for user-real
      expect(userDb.has('user-real')).toBe(true);
      expect(clientDb.has('client-user-real')).toBe(true);
      expect(subscriptionDb.has('sub-user-real')).toBe(true);
      expect(categoryDb.has('cat-user-real')).toBe(true);
      expect(budgetDb.has('bud-user-real')).toBe(true);
      expect(invoiceDb.has('inv-user-real')).toBe(true);
      expect(invoiceLineItemDb.has('item-user-real')).toBe(true);
      expect(transactionDb.has('tx-user-real')).toBe(true);
      expect(notificationDb.has('notif-user-real')).toBe(true);
      expect(auditLogDb.has('audit-user-real')).toBe(true);
      expect(deviceTokenDb.has('dev-user-real')).toBe(true);

      const marker = deletionDb.get('user-real');
      expect(marker.status).toBe('AUTH_DELETED');
      expect(marker.lastErrorCode).toBe('FINANCE_CLEANUP_FAILED');

      mockPrisma.accountDeletion.updateMany = origUpdateMany;
      const retryRes = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(retryRes.status).toBe(200);
      expect(userDb.has('user-real')).toBe(false);
      expect(deletionDb.get('user-real').status).toBe('COMPLETED');
    });

    it('zero fence count on expired lease: DELETE handler returns 409, zero finance writes, marker remains AUTH_DELETED', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      try {
        let resolveAuthCall: (val: any) => void;
        const authEnteredPromise = new Promise<void>((entered) => {
          mockSupabaseAdmin.deleteUser.mockImplementationOnce(() => {
            entered();
            return new Promise((r) => {
              resolveAuthCall = r;
            });
          });
        });

        // 1. Launch DELETE request in background
        const deletePromise = deleteUserAccount(request('DELETE', '/api/user/delete', {
          Authorization: 'Bearer real-supabase-token',
        }));

        await authEnteredPromise;

        // 2. Advance time past 60s lease (65s) before Auth settles
        jest.setSystemTime(Date.now() + 65_000);

        // 3. Release Auth successfully (moves phase to AUTH_DELETED)
        resolveAuthCall!({ data: { user: {} }, error: null });

        // 4. Old runner attempts transaction fence: lease is expired (+65s), so fence.count === 0!
        const deleteRes = await deletePromise;

        expect(deleteRes.status).toBe(409);
        const json = await deleteRes.json();
        expect(json.code).toBe('CLAIM_EXPIRED');
        expect(json.deletionPending).toBe(true);

        // All 11 per-user stores remain completely unchanged (zero deletes executed)
        expect(userDb.has('user-real')).toBe(true);
        expect(clientDb.has('client-user-real')).toBe(true);
        expect(subscriptionDb.has('sub-user-real')).toBe(true);
        expect(categoryDb.has('cat-user-real')).toBe(true);
        expect(budgetDb.has('bud-user-real')).toBe(true);
        expect(invoiceDb.has('inv-user-real')).toBe(true);
        expect(invoiceLineItemDb.has('item-user-real')).toBe(true);
        expect(transactionDb.has('tx-user-real')).toBe(true);
        expect(notificationDb.has('notif-user-real')).toBe(true);
        expect(auditLogDb.has('audit-user-real')).toBe(true);
        expect(deviceTokenDb.has('dev-user-real')).toBe(true);

        const marker = deletionDb.get('user-real');
        expect(marker.status).toBe('AUTH_DELETED');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('3b. Final COMPLETED commit loses its claim (mocked Prisma: proves code logic, NOT Postgres transaction concurrency)', () => {
    // The mock $transaction snapshots the in-memory maps and restores them if the callback throws,
    // which models rollback semantics only; it does not exercise real row locks or isolation.
    const dropCompletedCommit = (onDrop?: () => void) => {
      const orig = mockPrisma.accountDeletion.updateMany;
      mockPrisma.accountDeletion.updateMany = jest.fn(async (args: any) => {
        if (args?.data?.status === 'COMPLETED') {
          onDrop?.();
          return { count: 0 };
        }
        return orig(args);
      });
      return orig;
    };

    it('count 0 on the final commit and row not COMPLETED: throws CLAIM_EXPIRED and rolls back every domain table', async () => {
      armAuthDeletedRow('user-a', 'worker-1');
      const before = snapshotDomainRows();

      const orig = dropCompletedCommit();
      try {
        await expect(
          executeFencedFinancialCleanupTransaction(mockPrisma, 'user-a', 'worker-1'),
        ).rejects.toMatchObject({ statusCode: 409, code: 'CLAIM_EXPIRED', deletionPending: true });
      } finally {
        mockPrisma.accountDeletion.updateMany = orig;
      }

      // Deletes were really issued inside the tx, so it is the rollback that restored the rows.
      expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'user-a' } });
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledTimes(1);

      expect(snapshotDomainRows()).toEqual(before);
      const marker = deletionDb.get('user-a');
      expect(marker.status).toBe('AUTH_DELETED');
      expect(marker.completedAt).toBeNull();
      expect(marker.ownerToken).toBe('worker-1');
    });

    it('count 0 on the final commit but another worker already COMPLETED the row: returns ok and does not re-complete it', async () => {
      armAuthDeletedRow('user-a', 'worker-1');
      const otherCompletedAt = new Date('2030-01-01T00:00:00Z');

      const orig = dropCompletedCommit(() => {
        // Another worker finished first: row is COMPLETED and owned by nobody.
        deletionDb.set('user-a', {
          ...deletionDb.get('user-a'),
          status: 'COMPLETED',
          completedAt: otherCompletedAt,
          ownerToken: null,
          leaseExpiresAt: null,
        });
      });
      let result: { ok: boolean };
      try {
        result = await executeFencedFinancialCleanupTransaction(mockPrisma, 'user-a', 'worker-1');
      } finally {
        mockPrisma.accountDeletion.updateMany = orig;
      }

      expect(result).toEqual({ ok: true });
      const marker = deletionDb.get('user-a');
      expect(marker.status).toBe('COMPLETED');
      expect(marker.completedAt).toEqual(otherCompletedAt); // this worker did not write completion
      expect(userDb.has('user-b')).toBe(true);
    });
  });

  describe('3c. Per-owner exactly-once cleanup across all 10 tables (mocked Prisma: logic only)', () => {
    const deleteResultCounts = async () => {
      const entries = await Promise.all(
        DOMAIN_STORES.map(async ([name]) => {
          const results = mockPrisma[name].deleteMany.mock.results;
          const counts = await Promise.all(results.map((r: any) => r.value));
          return [name, counts.map((c: { count: number }) => c.count)] as const;
        }),
      );
      return Object.fromEntries(entries);
    };

    it('deleting A removes exactly A rows in each of the 10 tables, keeps B intact, and a second run does no more deletes', async () => {
      seedExtraRows('user-a', 1); // A: 2 rows per table (1 user row)
      seedExtraRows('user-b', 2); // B: 3 rows per table (1 user row)
      const bBefore = snapshotDomainRows();
      Object.keys(bBefore).forEach((k) => {
        bBefore[k] = bBefore[k].filter((id) => id.includes('user-b'));
      });

      const first = await executeAccountDeletionWorkflow('user-a', { isDevUser: true, caller: 'delete' });
      expect(first).toEqual({ ok: true });

      // Exactly one deleteMany per table, with exactly A's removal counts.
      expect(await deleteResultCounts()).toEqual({
        notification: [2],
        invoiceLineItem: [2],
        invoice: [2],
        transaction: [2],
        budget: [2],
        subscription: [2],
        client: [2],
        category: [2],
        auditLog: [2],
        user: [1],
      });

      // No A row remains; B's rows are exactly as before; the third seeded user (user-real) is untouched.
      for (const [name, get] of DOMAIN_STORES) {
        const ids = Array.from(get().keys());
        expect(ids.filter((id) => id.includes('user-a'))).toEqual([]);
        expect(ids.filter((id) => id.includes('user-b')).sort()).toEqual(bBefore[name]);
        expect(ids.filter((id) => id.includes('user-real'))).toHaveLength(1);
      }
      expect(deletionDb.get('user-a').status).toBe('COMPLETED');

      // Idempotent: a retry after completion issues zero further deletes and changes nothing.
      const afterFirst = snapshotDomainRows();
      DOMAIN_STORES.forEach(([name]) => mockPrisma[name].deleteMany.mockClear());
      const second = await executeAccountDeletionWorkflow('user-a', { isDevUser: true, caller: 'delete' });
      expect(second).toEqual({ ok: true });
      DOMAIN_STORES.forEach(([name]) => expect(mockPrisma[name].deleteMany).not.toHaveBeenCalled());
      expect(snapshotDomainRows()).toEqual(afterFirst);

      // The fenced transaction invoked directly against a COMPLETED row is likewise a no-op.
      const third = await executeFencedFinancialCleanupTransaction(mockPrisma, 'user-a', 'stale-token');
      expect(third).toEqual({ ok: true });
      DOMAIN_STORES.forEach(([name]) => expect(mockPrisma[name].deleteMany).not.toHaveBeenCalled());
    });
  });

  describe('4. Driven Concurrency: DELETE vs Cron Race & Stalled Loser Isolation', () => {
    it('launch DELETE with deferred Auth -> test clock advances past 60s -> cron wins -> old DELETE finishes safely', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      try {
        let resolveAuthCall: (val: any) => void;
        const authEnteredPromise = new Promise<void>((entered) => {
          mockSupabaseAdmin.deleteUser.mockImplementationOnce(() => {
            entered();
            return new Promise((r) => {
              resolveAuthCall = r;
            });
          });
        });

        const deletePromise = deleteUserAccount(request('DELETE', '/api/user/delete', {
          Authorization: 'Bearer real-supabase-token',
        }));

        await authEnteredPromise;

        jest.setSystemTime(Date.now() + 65_000);

        // Cron claims expired lease and finishes deletion
        const cronRes = await runCron(request('GET', '/api/cron', {
          Authorization: 'Bearer test-cron-secret-123',
        }));
        expect(cronRes.status).toBe(200);

        const cronMarker = deletionDb.get('user-real');
        expect(cronMarker.status).toBe('COMPLETED');
        expect(userDb.has('user-real')).toBe(false);

        // Release old deferred Auth call with failure
        resolveAuthCall!({ data: null, error: { message: 'Late network failure', status: 500 } });

        const deleteRes = await deletePromise;
        expect(deleteRes.status).toBe(200);
        expect(await deleteRes.json()).toEqual({ ok: true });

        const finalMarker = deletionDb.get('user-real');
        expect(finalMarker.status).toBe('COMPLETED');
        expect(finalMarker.lastErrorCode).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('stale-loser failure cannot overwrite lease or error when a new unexpired owner claimed a non-COMPLETED marker', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      try {
        let resolveOldAuth: (val: any) => void;
        const oldAuthEntered = new Promise<void>((r) => {
          mockSupabaseAdmin.deleteUser.mockImplementationOnce(() => {
            r();
            return new Promise((res) => {
              resolveOldAuth = res;
            });
          });
        });

        // 1. Old DELETE launches and stalls in Auth
        const oldDeletePromise = deleteUserAccount(request('DELETE', '/api/user/delete', {
          Authorization: 'Bearer real-supabase-token',
        }));

        await oldAuthEntered;

        // 2. Clock advances past 60s lease
        jest.setSystemTime(Date.now() + 65_000);

        // 3. New cron runner begins claim and stalls in SECOND Auth call
        let resolveNewAuth: (val: any) => void;
        const newAuthEntered = new Promise<void>((r) => {
          mockSupabaseAdmin.deleteUser.mockImplementationOnce(() => {
            r();
            return new Promise((res) => {
              resolveNewAuth = res;
            });
          });
        });

        const cronPromise = runCron(request('GET', '/api/cron', {
          Authorization: 'Bearer test-cron-secret-123',
        }));

        await newAuthEntered;

        // Capture new active marker
        const activeMarker = deletionDb.get('user-real');
        const activeOwnerToken = activeMarker.ownerToken;
        const activeLease = activeMarker.leaseExpiresAt;
        expect(activeOwnerToken).toBeDefined();

        // 4. Release OLD Auth with failure while new marker is still PENDING / unexpired
        resolveOldAuth!({ data: null, error: { message: 'Old failure', status: 500 } });

        const oldDeleteRes = await oldDeletePromise;
        expect(oldDeleteRes.status).toBe(502);

        // Assert: new owner, lease, and error are COMPLETELY UNCHANGED
        const checkMarker = deletionDb.get('user-real');
        expect(checkMarker.ownerToken).toBe(activeOwnerToken);
        expect(checkMarker.leaseExpiresAt).toEqual(activeLease);
        expect(checkMarker.lastErrorCode).toBeNull();

        // 5. Release new Auth with success -> cron finishes COMPLETED
        resolveNewAuth!({ data: { user: {} }, error: null });
        const cronRes = await cronPromise;
        expect(cronRes.status).toBe(200);

        expect(deletionDb.get('user-real').status).toBe('COMPLETED');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('5. Driven Exhaustion Lifecycle & Stale-Selection Cap Race', () => {
    it('progresses naturally from attempt 4 -> 5, denies regular requests and ensureUser, allows manual retry', async () => {
      deletionDb.set('user-exhausting', {
        id: 'del-exh',
        userId: 'user-exhausting',
        status: 'PENDING',
        attempts: 4,
        isDev: false,
        ownerToken: null,
        leaseExpiresAt: null,
      });
      userDb.set('user-exhausting', { id: 'user-exhausting', email: 'exh@example.com' });

      mockSupabaseAdmin.deleteUser.mockResolvedValueOnce({
        data: null,
        error: { message: '500 Server Error', status: 500 },
      });
      mockSupabaseAdmin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-exhausting' } },
        error: null,
      });

      const cronRes = await runCron(request('GET', '/api/cron', {
        Authorization: 'Bearer test-cron-secret-123',
      }));
      expect(cronRes.status).toBe(200);

      const marker = deletionDb.get('user-exhausting');
      expect(marker.attempts).toBe(5);
      expect(marker.lastErrorCode).toBe('MAX_RETRIES_EXCEEDED');
      expect(marker.status).toBe('PENDING');

      const clientRes = await getClients(request('GET', '/api/clients', {
        Authorization: `Bearer ${tokenFor('user-exhausting')}`,
      }));
      expect(clientRes.status).toBe(403);

      await expect(ensureUser({ id: 'user-exhausting', email: 'exh@example.com' })).rejects.toThrow(
        expect.objectContaining({ statusCode: 403 })
      );

      mockSupabaseAdmin.deleteUser.mockResolvedValueOnce({ data: { user: {} }, error: null });
      const retryRes = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: `Bearer ${tokenFor('user-exhausting')}`,
      }));
      expect(retryRes.status).toBe(200);
      expect(deletionDb.get('user-exhausting').status).toBe('COMPLETED');
    });

    it('driven stale-selection cap race: cron snapshot allows job with 4 attempts, but intervening claim fails when cap hit', async () => {
      deletionDb.set('user-capped', {
        id: 'del-cap',
        userId: 'user-capped',
        status: 'PENDING',
        attempts: 4,
        ownerToken: null,
        leaseExpiresAt: null,
      });
      userDb.set('user-capped', { id: 'user-capped', email: 'capped@example.com' });

      // Intervening worker drives attempts to 5 just before conditional claim updateMany evaluates
      const origUpdateMany = mockPrisma.accountDeletion.updateMany;
      let injected = false;
      mockPrisma.accountDeletion.updateMany = jest.fn(async (args: any) => {
        if (!injected && args?.where?.userId === 'user-capped' && args?.where?.attempts) {
          injected = true;
          deletionDb.get('user-capped').attempts = 5;
        }
        return origUpdateMany(args);
      });

      const cronRes = await runCron(request('GET', '/api/cron', {
        Authorization: 'Bearer test-cron-secret-123',
      }));
      expect(cronRes.status).toBe(200);
      const json = await cronRes.json();
      expect(json.deletionsFailed).toBe(1);
      expect(json.deletionsProcessed).toBe(0);
      expect(mockSupabaseAdmin.deleteUser).not.toHaveBeenCalled();
      expect(userDb.has('user-capped')).toBe(true);
    });

    it('respects non-default maxAttempts passed to retryPendingDeletions', async () => {
      deletionDb.set('user-lowcap', {
        id: 'del-lowcap',
        userId: 'user-lowcap',
        status: 'PENDING',
        attempts: 2,
        ownerToken: null,
        leaseExpiresAt: null,
      });

      // With maxAttempts = 2, it is excluded
      const res = await retryPendingDeletions(20, 2);
      expect(res.processed).toBe(0);
      expect(res.failed).toBe(0);
    });
  });

  describe('6. Multi-Job Isolation: Claim Failure, Secondary Record Failure, Active Maintenance', () => {
    it('eligible first job claim update genuinely throws, second job succeeds, active user maintenance still runs', async () => {
      userDb.clear();
      userDb.set('user-active', { id: 'user-active', email: 'active@example.com', notifyBillingReminders: false, notifyInvoiceDue: false });
      seedUserFinanceData('user-job-1');
      seedUserFinanceData('user-job-2');

      deletionDb.set('user-job-1', {
        id: 'del-1',
        userId: 'user-job-1',
        status: 'PENDING',
        ownerToken: null,
        leaseExpiresAt: null,
        attempts: 0,
      });

      deletionDb.set('user-job-2', {
        id: 'del-2',
        userId: 'user-job-2',
        status: 'AUTH_DELETED',
        ownerToken: null,
        leaseExpiresAt: null,
        attempts: 0,
      });

      let job1ClaimThrown = false;
      const origUpdateMany = mockPrisma.accountDeletion.updateMany;
      mockPrisma.accountDeletion.updateMany = jest.fn(async (args: any) => {
        if (!job1ClaimThrown && args?.where?.userId === 'user-job-1' && args?.data?.ownerToken) {
          job1ClaimThrown = true;
          throw new Error('Database connection drop on job 1 claim');
        }
        return origUpdateMany(args);
      });

      const res = await runCron(request('GET', '/api/cron', {
        Authorization: 'Bearer test-cron-secret-123',
      }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(job1ClaimThrown).toBe(true);
      expect(json.deletionsFailed).toBe(1); // Job 1 failed claim
      expect(json.deletionsProcessed).toBe(1); // Job 2 completed
      expect(json.processed).toBe(1); // Active maintenance ran

      expect(deletionDb.get('user-job-2').status).toBe('COMPLETED');
      expect(userDb.has('user-job-2')).toBe(false);
      expect(userDb.has('user-active')).toBe(true);
    });

    it('eligible AUTH_DELETED first job cleanup fails and secondary failure-record update ALSO rejects; second job succeeds', async () => {
      userDb.clear();
      userDb.set('user-active', { id: 'user-active', email: 'active@example.com', notifyBillingReminders: false, notifyInvoiceDue: false });
      seedUserFinanceData('user-job-1');
      seedUserFinanceData('user-job-2');

      deletionDb.set('user-job-1', {
        id: 'del-1',
        userId: 'user-job-1',
        status: 'AUTH_DELETED',
        ownerToken: null,
        leaseExpiresAt: null,
        attempts: 0,
      });

      deletionDb.set('user-job-2', {
        id: 'del-2',
        userId: 'user-job-2',
        status: 'AUTH_DELETED',
        ownerToken: null,
        leaseExpiresAt: null,
        attempts: 0,
      });

      let job1CleanupFailed = false;
      let job1SecondaryErrorRejected = false;

      const origTransaction = mockPrisma.$transaction;
      mockPrisma.$transaction = jest.fn(async (cb: any) => {
        if (!job1CleanupFailed) {
          job1CleanupFailed = true;
          throw new Error('Primary finance transaction crash on job 1');
        }
        return origTransaction(cb);
      });

      const origUpdateMany = mockPrisma.accountDeletion.updateMany;
      mockPrisma.accountDeletion.updateMany = jest.fn(async (args: any) => {
        if (args?.where?.userId === 'user-job-1' && args?.data?.lastErrorCode) {
          job1SecondaryErrorRejected = true;
          throw new Error('Secondary persistence failure on job 1');
        }
        return origUpdateMany(args);
      });

      const res = await runCron(request('GET', '/api/cron', {
        Authorization: 'Bearer test-cron-secret-123',
      }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(job1CleanupFailed).toBe(true);
      expect(job1SecondaryErrorRejected).toBe(true);
      expect(json.deletionsFailed).toBe(1);
      expect(json.deletionsProcessed).toBe(1);
      expect(json.processed).toBe(1);

      expect(deletionDb.get('user-job-2').status).toBe('COMPLETED');
      expect(userDb.has('user-active')).toBe(true);
    });
  });

  describe('7. Strict Absence Regressions (Ambiguous 404, Generic Text, Network Error)', () => {
    test.each([
      ['ambiguous 404 without user_not_found code', { message: 'Route not found', status: 404 }, { data: { user: { id: 'user-real' } }, error: null }],
      ['generic text "user not found" with status 500', { message: 'user not found in upstream database', status: 500 }, { data: { user: { id: 'user-real' } }, error: null }],
      ['network lookup failure on getUserById', { message: 'Auth service down' }, { data: null, error: { message: 'Network timeout', status: 504 } }],
      ['null-user without documented error code', { message: 'Auth service down' }, { data: { user: null }, error: null }],
    ])('%s must retain finance and return 502', async (_, deleteErr, getByIdResult) => {
      mockSupabaseAdmin.deleteUser.mockResolvedValueOnce({ data: null, error: deleteErr });
      if (getByIdResult.data === null && getByIdResult.error) {
        mockSupabaseAdmin.getUserById.mockRejectedValueOnce(getByIdResult.error);
      } else {
        mockSupabaseAdmin.getUserById.mockResolvedValueOnce(getByIdResult);
      }

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.code).toBe('AUTH_DELETE_FAILED');
      expect(json.deletionPending).toBe(true);
      expect(userDb.has('user-real')).toBe(true);
      expect(deletionDb.get('user-real').status).toBe('PENDING');
    });

    it('accepts documented user_not_found code directly from deleteUser and finishes cleanup', async () => {
      mockSupabaseAdmin.deleteUser.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found', status: 404, code: 'user_not_found' },
      });

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(userDb.has('user-real')).toBe(false);
      expect(deletionDb.get('user-real').status).toBe('COMPLETED');
    });

    it('accepts generic error from deleteUser when authoritative getUserById confirms user_not_found', async () => {
      mockSupabaseAdmin.deleteUser.mockResolvedValueOnce({
        data: null,
        error: { message: 'Upstream HTTP error', status: 400 },
      });
      mockSupabaseAdmin.getUserById.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found', status: 404, code: 'user_not_found' },
      });

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(userDb.has('user-real')).toBe(false);
      expect(deletionDb.get('user-real').status).toBe('COMPLETED');
    });
  });

  describe('8. Dev Provenance, Email Reuse, Cron Secrets & PII Exclusion', () => {
    it('dev user stores isDev: true provenance and cron resumes without calling Supabase Auth admin', async () => {
      deletionDb.set('dev-crashed', {
        id: 'del-dev',
        userId: 'dev-crashed',
        status: 'PENDING',
        isDev: true,
        attempts: 0,
        ownerToken: null,
        leaseExpiresAt: null,
      });
      userDb.set('dev-crashed', { id: 'dev-crashed', email: 'dev-crashed@example.com' });

      const res = await runCron(request('GET', '/api/cron', {
        Authorization: 'Bearer test-cron-secret-123',
      }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.deletionsProcessed).toBe(1);
      expect(mockSupabaseAdmin.deleteUser).not.toHaveBeenCalled();
      expect(userDb.has('dev-crashed')).toBe(false);
      expect(deletionDb.get('dev-crashed').status).toBe('COMPLETED');
    });

    it('ensureUser never deletes stale owner finance; rejects until cleanup completed, then permits fresh ID', async () => {
      deletionDb.set('user-old', {
        id: 'del-old',
        userId: 'user-old',
        status: 'PENDING',
        attempts: 1,
      });
      userDb.set('user-old', { id: 'user-old', email: 'shared@example.com' });

      await expect(ensureUser({ id: 'user-new', email: 'shared@example.com' })).rejects.toThrow(
        expect.objectContaining({ statusCode: 409 })
      );
      expect(userDb.has('user-old')).toBe(true);

      userDb.delete('user-old');
      deletionDb.get('user-old').status = 'COMPLETED';

      await ensureUser({ id: 'user-new', email: 'shared@example.com' });
      expect(userDb.has('user-new')).toBe(true);
    });

    it('denies cron when CRON_SECRET is missing or spoofed', async () => {
      delete process.env.CRON_SECRET;
      const res1 = await runCron(request('GET', '/api/cron', { 'x-vercel-cron': '1' }));
      expect(res1.status).toBe(401);

      process.env.CRON_SECRET = 'secret-configured';
      const res2 = await runCron(request('GET', '/api/cron', {
        'x-vercel-cron': '1',
        Authorization: 'Bearer bad-secret',
      }));
      expect(res2.status).toBe(401);
    });

    it('ensures sensitive PII in caught error is never exposed in response or stored marker', async () => {
      mockSupabaseAdmin.deleteUser.mockRejectedValueOnce(
        new Error('Failed for user sensitive-user@victim.com with secret token secret-token-xyz123')
      );
      mockSupabaseAdmin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-real' } },
        error: null,
      });

      const res = await deleteUserAccount(request('DELETE', '/api/user/delete', {
        Authorization: 'Bearer real-supabase-token',
      }));

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(JSON.stringify(json)).not.toContain('sensitive-user@victim.com');
      expect(JSON.stringify(json)).not.toContain('secret-token-xyz123');
      expect(json.code).toBe('AUTH_DELETE_FAILED');
      expect(json.deletionPending).toBe(true);

      const marker = deletionDb.get('user-real');
      expect(marker.lastErrorCode).toBe('AUTH_DELETE_FAILED');
      expect(JSON.stringify(marker)).not.toContain('sensitive-user@victim.com');
    });
  });
});
