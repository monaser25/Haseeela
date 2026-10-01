import type { SupabaseClient } from '@supabase/supabase-js';
import { requestAccountDeletion, ACCOUNT_DELETION_TIMEOUT_MS } from '../accountApi';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { getSessionEpoch, resetAuthScope, setAuthScope } from '../../auth/authScope';
import { MockHttpServer } from '../../test';

const originalFetch = global.fetch;

describe('requestAccountDeletion', () => {
  let server: MockHttpServer;

  beforeEach(() => {
    resetAuthScope();
    setAuthScope('user-A');
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { access_token: 'tok', user: { id: 'user-A' } } },
          error: null,
        }),
        signOut: jest.fn(),
      },
    } as unknown as SupabaseClient);
    server = new MockHttpServer();
    global.fetch = server.fetchHandler;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    setSupabaseClientForTesting(null);
  });

  const options = () => ({ expectedOwnerId: 'user-A', expectedEpoch: getSessionEpoch() });

  it('reports a completed deletion only for 200 { ok: true }', async () => {
    await expect(requestAccountDeletion(options())).resolves.toEqual({ status: 'deleted' });
    expect(server.getRequestCount('DELETE', '/api/user/delete')).toBe(1);
  });

  it('does not claim completion for a 200 without ok: true', async () => {
    server.setError('/api/user/delete', 200, { unexpected: true });
    await expect(requestAccountDeletion(options())).resolves.toEqual({ status: 'pending' });
  });

  it('fails without sending when the call is fenced to a different owner', async () => {
    await expect(
      requestAccountDeletion({ expectedOwnerId: 'user-B', expectedEpoch: getSessionEpoch() })
    ).resolves.toEqual({ status: 'failed' });
    expect(server.getRequestCount('DELETE', '/api/user/delete')).toBe(0);
  });

  it('aborts a hung request after the timeout and treats it as in progress', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        })
    ) as unknown as typeof fetch;

    const result = requestAccountDeletion(options());
    await jest.advanceTimersByTimeAsync(ACCOUNT_DELETION_TIMEOUT_MS);

    await expect(result).resolves.toEqual({ status: 'pending' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
