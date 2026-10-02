const mockPrisma: any = { $queryRaw: jest.fn() };
jest.mock('@/server/prisma', () => ({ prisma: mockPrisma }));

import { GET as health } from '@/app/api/health/route';

describe('/api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MIN_MOBILE_VERSION;
    jest.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns status, time and the default minMobileVersion', async () => {
    const res = await health(new Request('http://localhost/api/health'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.time).toBe('string');
    expect(body.minMobileVersion).toBe('1.0.0');
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reads minMobileVersion from MIN_MOBILE_VERSION', async () => {
    process.env.MIN_MOBILE_VERSION = '1.4.2';
    const body = await (await health(new Request('http://localhost/api/health'))).json();
    expect(body.minMobileVersion).toBe('1.4.2');
  });

  it('still fails when the database check fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('down'));
    const res = await health(new Request('http://localhost/api/health'));
    expect(res.status).toBe(500);
  });
});
