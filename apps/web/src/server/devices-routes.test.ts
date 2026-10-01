const tokens = new Map<string, { token: string; userId: string; platform: string }>();

const mockPrisma: any = {
  accountDeletion: { findUnique: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  deviceToken: {
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const existing = tokens.get(where.token);
      const row = existing ? { ...existing, ...update } : { ...create };
      tokens.set(where.token, row);
      return row;
    }),
    deleteMany: jest.fn(async ({ where }: any) => {
      const row = tokens.get(where.token);
      if (row && row.userId === where.userId) {
        tokens.delete(where.token);
        return { count: 1 };
      }
      return { count: 0 };
    }),
  },
};

jest.mock('@/server/prisma', () => ({ prisma: mockPrisma }));

import { POST as register } from '@/app/api/devices/register/route';
import { POST as unregister } from '@/app/api/devices/unregister/route';

const TOKEN = 'ExponentPushToken[abc123_DEF-456]';

const tokenFor = (id: string) => `flowledger-dev:${encodeURIComponent(JSON.stringify({ id, email: `${id}@example.com` }))}`;

const post = (path: string, body: unknown, userId: string | null = 'user-a') => new Request(`http://localhost${path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(userId ? { Authorization: `Bearer ${tokenFor(userId)}` } : {}),
  },
  body: JSON.stringify(body),
});

describe('device token routes', () => {
  beforeEach(() => {
    process.env.ENABLE_DEV_AUTH = 'true';
    tokens.clear();
    jest.clearAllMocks();
    mockPrisma.accountDeletion.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve({
      id: where.id,
      email: `${where.id}@example.com`,
      name: where.id,
    }));
  });

  it('requires authentication', async () => {
    expect((await register(post('/api/devices/register', { token: TOKEN, platform: 'ios' }, null))).status).toBe(401);
    expect((await unregister(post('/api/devices/unregister', { token: TOKEN }, null))).status).toBe(401);
    expect(mockPrisma.deviceToken.upsert).not.toHaveBeenCalled();
  });

  it('registers a token for the caller and is idempotent', async () => {
    const first = await register(post('/api/devices/register', { token: TOKEN, platform: 'android' }));
    const second = await register(post('/api/devices/register', { token: TOKEN, platform: 'android' }));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect(second.status).toBe(200);
    expect(tokens.size).toBe(1);
    expect(tokens.get(TOKEN)).toEqual(expect.objectContaining({ userId: 'user-a', platform: 'android' }));
  });

  it('accepts the ExpoPushToken[...] spelling', async () => {
    const res = await register(post('/api/devices/register', { token: 'ExpoPushToken[xyz]', platform: 'ios' }));
    expect(res.status).toBe(200);
  });

  it.each([
    [{ token: 'not-a-token', platform: 'ios' }],
    [{ token: 'ExponentPushToken[]', platform: 'ios' }],
    [{ token: TOKEN, platform: 'web' }],
    [{ token: TOKEN }],
    [{ platform: 'ios' }],
  ])('rejects invalid register body %j', async (body) => {
    const res = await register(post('/api/devices/register', body));
    expect(res.status).toBe(400);
    expect(mockPrisma.deviceToken.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid unregister token', async () => {
    const res = await unregister(post('/api/devices/unregister', { token: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('reassigns a token from user A to user B so A no longer owns it', async () => {
    await register(post('/api/devices/register', { token: TOKEN, platform: 'ios' }, 'user-a'));
    const res = await register(post('/api/devices/register', { token: TOKEN, platform: 'ios' }, 'user-b'));

    expect(res.status).toBe(200);
    expect(tokens.size).toBe(1);
    expect(tokens.get(TOKEN)?.userId).toBe('user-b');
  });

  it('unregister deletes only the caller own token', async () => {
    await register(post('/api/devices/register', { token: TOKEN, platform: 'ios' }, 'user-a'));
    const res = await unregister(post('/api/devices/unregister', { token: TOKEN }, 'user-a'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(tokens.has(TOKEN)).toBe(false);
  });

  it('unregister of another user token is a no-op 200', async () => {
    await register(post('/api/devices/register', { token: TOKEN, platform: 'ios' }, 'user-a'));
    const res = await unregister(post('/api/devices/unregister', { token: TOKEN }, 'user-b'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(tokens.get(TOKEN)?.userId).toBe('user-a');
  });

  it('rejects accounts pending deletion', async () => {
    mockPrisma.accountDeletion.findUnique.mockResolvedValue({ userId: 'user-a', status: 'PENDING' });

    const reg = await register(post('/api/devices/register', { token: TOKEN, platform: 'ios' }));
    const unreg = await unregister(post('/api/devices/unregister', { token: TOKEN }));

    expect(reg.status).toBe(403);
    expect(unreg.status).toBe(403);
    expect(mockPrisma.deviceToken.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.deviceToken.deleteMany).not.toHaveBeenCalled();
  });
});
