const mockPrisma: any = {
  user: { findUnique: jest.fn() },
  subscription: { findMany: jest.fn() },
  client: { findMany: jest.fn() },
  invoice: { findMany: jest.fn() },
  notification: { findMany: jest.fn(), createMany: jest.fn() },
  deviceToken: { findMany: jest.fn(), deleteMany: jest.fn() },
};

jest.mock('@/server/prisma', () => ({ prisma: mockPrisma }));

import {
  buildPushPayload,
  isAllowedPushRoute,
  sendPushToUser,
  EXPO_PUSH_URL,
  PUSH_ROUTE_ALLOWLIST,
} from '@/server/push';
import { generateNotifications } from '@/server/notifications';

const okResponse = (tickets: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: tickets }),
}) as unknown as Response;

const tokenList = (n: number) => Array.from({ length: n }, (_, i) => ({ token: `ExponentPushToken[t${i}]` }));

describe('push sender', () => {
  const originalEnv = process.env;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXPO_ACCESS_TOKEN;
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('sends nothing when the user has no devices', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue([]);
    const fetchImpl = jest.fn();
    const result = await sendPushToUser('u1', { kind: 'reminders', route: '/(app)/notifications' }, { fetchImpl });
    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('batches into requests of at most 100 messages', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokenList(250));
    const fetchImpl = jest.fn(async (_url: string, init: any) => {
      const messages = JSON.parse(init.body);
      return okResponse(messages.map(() => ({ status: 'ok' })));
    });

    const result = await sendPushToUser('u1', { kind: 'reminders', route: '/(app)/notifications' }, { fetchImpl: fetchImpl as any });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const sizes = fetchImpl.mock.calls.map((c: any) => JSON.parse(c[1].body).length);
    expect(sizes).toEqual([100, 100, 50]);
    expect(fetchImpl.mock.calls[0][0]).toBe(EXPO_PUSH_URL);
    expect(result.sent).toBe(250);
  });

  it('only sets the Authorization header when EXPO_ACCESS_TOKEN is configured', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokenList(1));
    const fetchImpl = jest.fn(async () => okResponse([{ status: 'ok' }]));

    await sendPushToUser('u1', { kind: 'reminders', route: '/(app)/notifications' }, { fetchImpl: fetchImpl as any });
    expect((fetchImpl.mock.calls[0] as any)[1].headers.Authorization).toBeUndefined();

    process.env.EXPO_ACCESS_TOKEN = 'secret-access-token';
    await sendPushToUser('u1', { kind: 'reminders', route: '/(app)/notifications' }, { fetchImpl: fetchImpl as any });
    expect((fetchImpl.mock.calls[1] as any)[1].headers.Authorization).toBe('Bearer secret-access-token');
    expect(JSON.stringify([...errorSpy.mock.calls, ...warnSpy.mock.calls])).not.toContain('secret-access-token');
  });

  it('deletes tokens reported as DeviceNotRegistered (scoped to the user)', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokenList(3));
    const fetchImpl = jest.fn(async () => okResponse([
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ]));

    const result = await sendPushToUser('u1', { kind: 'billing_due', route: '/(app)/subscriptions' }, { fetchImpl: fetchImpl as any });

    expect(result).toEqual({ sent: 1, removed: 1 });
    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: { in: ['ExponentPushToken[t1]'] } },
    });
  });

  it('rejects non-allowlisted routes without calling fetch', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokenList(1));
    const fetchImpl = jest.fn();

    const result = await sendPushToUser('u1', { kind: 'reminders', route: '/(app)/settings' as any }, { fetchImpl });

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mockPrisma.deviceToken.findMany).not.toHaveBeenCalled();
  });

  it('validates the route allowlist and params', () => {
    for (const route of PUSH_ROUTE_ALLOWLIST) {
      const params = route === '/(app)/invoice/[id]' ? { id: 'abc-123' } : undefined;
      expect(isAllowedPushRoute(route, params)).toBe(true);
    }
    expect(isAllowedPushRoute('/(app)/invoice/[id]')).toBe(false);
    expect(isAllowedPushRoute('/(app)/invoice/[id]', { id: '../x' })).toBe(false);
    expect(isAllowedPushRoute('/(app)/subscriptions', { id: 'x' })).toBe(false);
    expect(isAllowedPushRoute('https://evil.example')).toBe(false);
    expect(() => buildPushPayload('ExponentPushToken[a]', { kind: 'reminders', route: '/x' as any })).toThrow();
  });

  it('payload contains no PII, only generic copy, keys and an allowlisted route', () => {
    const payload = buildPushPayload('ExponentPushToken[a]', {
      kind: 'invoice_overdue',
      route: '/(app)/invoice/[id]',
      params: { id: 'inv-1' },
    });
    expect(payload).toEqual({
      to: 'ExponentPushToken[a]',
      title: 'Haseela',
      body: 'An invoice is overdue.',
      sound: 'default',
      data: {
        kind: 'invoice_overdue',
        titleKey: 'push.invoiceOverdue.title',
        bodyKey: 'push.invoiceOverdue.body',
        route: '/(app)/invoice/[id]',
        params: { id: 'inv-1' },
      },
    });
  });

  it('swallows network failures and non-2xx responses without logging tokens', async () => {
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokenList(150));
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new Error('network down ExponentPushToken[t0]'))
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

    const result = await sendPushToUser('u1', { kind: 'reminders', route: '/(app)/notifications' }, { fetchImpl: fetchImpl as any });

    expect(result).toEqual({ sent: 0, removed: 0 });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('ExponentPushToken');
  });

  it('swallows database failures', async () => {
    mockPrisma.deviceToken.findMany.mockRejectedValue(new Error('db down'));
    await expect(
      sendPushToUser('u1', { kind: 'reminders', route: '/(app)/notifications' }, { fetchImpl: jest.fn() }),
    ).resolves.toEqual({ sent: 0, removed: 0 });
  });
});

describe('generateNotifications push hook', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  let errorSpy: jest.SpyInstance;
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = jest.fn(async (_url: string, init: any) => okResponse(JSON.parse(init.body).map(() => ({ status: 'ok' }))));
    global.fetch = fetchMock as any;
    mockPrisma.user.findUnique.mockResolvedValue({ notifyBillingReminders: true, notifyInvoiceDue: true });
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokenList(1));
  });

  afterEach(() => {
    global.fetch = realFetch;
    errorSpy.mockRestore();
  });

  const sentMessages = () => fetchMock.mock.calls.flatMap((c: any) => JSON.parse(c[1].body));

  it('does not push unless sendPush is requested', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', name: 'Secret Netflix', nextBillingDate: future }]);
    await generateNotifications('u1');
    expect(mockPrisma.notification.createMany).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pushes a generic message for a newly created billing reminder with no PII', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', name: 'Secret Netflix', nextBillingDate: future }]);

    await generateNotifications('u1', { sendPush: true });

    const messages = sentMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual(expect.objectContaining({ kind: 'billing_due', route: '/(app)/subscriptions' }));
    expect(JSON.stringify(messages)).not.toContain('Secret Netflix');
  });

  it('deep-links a single new overdue invoice by id only', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-9', number: 'INV-SECRET', dueDate: past }]);

    await generateNotifications('u1', { sendPush: true });

    const [message] = sentMessages();
    expect(message.data.route).toBe('/(app)/invoice/[id]');
    expect(message.data.params).toEqual({ id: 'inv-9' });
    expect(JSON.stringify(message)).not.toContain('INV-SECRET');
  });

  it('sends one push to the notifications list when several are new', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { id: 's1', name: 'A', nextBillingDate: future },
      { id: 's2', name: 'B', nextBillingDate: future },
    ]);
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1', number: 'N', dueDate: past }]);

    await generateNotifications('u1', { sendPush: true });

    const messages = sentMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual(expect.objectContaining({ kind: 'reminders', route: '/(app)/notifications' }));
  });

  it('does not push for notifications that already existed', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', name: 'A', nextBillingDate: future }]);
    mockPrisma.notification.findMany.mockResolvedValue([
      { refKey: `billing-sub:s1:${future.toISOString().slice(0, 10)}` },
    ]);

    await generateNotifications('u1', { sendPush: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors notifyBillingReminders=false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ notifyBillingReminders: false, notifyInvoiceDue: true });
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', name: 'A', nextBillingDate: future }]);

    await generateNotifications('u1', { sendPush: true });

    expect(mockPrisma.subscription.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors notifyInvoiceDue=false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ notifyBillingReminders: true, notifyInvoiceDue: false });
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1', number: 'N', dueDate: past }]);

    await generateNotifications('u1', { sendPush: true });

    expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('push failure never fails notification creation', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', name: 'A', nextBillingDate: future }]);
    fetchMock.mockRejectedValue(new Error('boom'));

    await expect(generateNotifications('u1', { sendPush: true })).resolves.toBeUndefined();
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('a failing freshness lookup still creates notifications and skips push', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([{ id: 's1', name: 'A', nextBillingDate: future }]);
    mockPrisma.notification.findMany.mockRejectedValue(new Error('db'));

    await expect(generateNotifications('u1', { sendPush: true })).resolves.toBeUndefined();
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
