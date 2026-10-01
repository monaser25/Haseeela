import type { SupabaseClient } from '@supabase/supabase-js';
import { apiRequest, handleExpiredSession } from '../client';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { bumpSessionEpoch, enqueueAuthOp, getSessionEpoch, resetAuthScope, setAuthScope } from '../../auth/authScope';
import { MockHttpServer } from '../../test';

const originalFetch = global.fetch;

function installClient(getSession: jest.Mock, signOut: jest.Mock) {
  setSupabaseClientForTesting({ auth: { getSession, signOut } } as unknown as SupabaseClient);
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('apiRequest: owner fallback removed', () => {
  let server: MockHttpServer;

  beforeEach(() => {
    resetAuthScope();
    server = new MockHttpServer();
    global.fetch = server.fetchHandler;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    setSupabaseClientForTesting(null);
  });

  it('rejects as unauthenticated with zero network calls when a token exists but the SDK user id is missing', async () => {
    installClient(
      jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null }),
      jest.fn()
    );
    setAuthScope('user-A');

    await expect(apiRequest('/api/user/preferences', { expectedOwnerId: 'user-A' })).rejects.toThrow(
      'Unauthenticated'
    );
    await expect(apiRequest('/api/user/preferences')).rejects.toThrow('Unauthenticated');
    expect(server.getRequests()).toHaveLength(0);
  });

  it('rejects when scope is uninitialized and the SDK session carries no user', async () => {
    installClient(
      jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok', user: {} } }, error: null }),
      jest.fn()
    );

    await expect(apiRequest('/api/user/preferences')).rejects.toThrow('Unauthenticated');
    expect(server.getRequests()).toHaveLength(0);
  });

  it('still succeeds when the SDK provides a real user id', async () => {
    installClient(
      jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok', user: { id: 'user-A' } } },
        error: null,
      }),
      jest.fn()
    );
    setAuthScope('user-A');

    await expect(apiRequest('/api/user/preferences')).resolves.toBeTruthy();
    expect(server.getRequests()).toHaveLength(1);
  });
});

describe('handleExpiredSession', () => {
  beforeEach(() => {
    resetAuthScope();
    setAuthScope('user-A');
  });

  afterAll(() => {
    setSupabaseClientForTesting(null);
  });

  it('signs out exactly once, without throwing, when the SDK getSession returns an error', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    installClient(
      jest.fn().mockResolvedValue({ data: { session: null }, error: new Error('sdk down') }),
      signOut
    );

    await expect(handleExpiredSession('user-A', getSessionEpoch())).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not throw and signs out once when getSession rejects', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    installClient(jest.fn().mockRejectedValue(new Error('boom')), signOut);

    await expect(handleExpiredSession('user-A', getSessionEpoch())).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('does not sign out when the SDK has no session or no user', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    const getSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
    installClient(getSession, signOut);
    await handleExpiredSession('user-A', getSessionEpoch());

    getSession.mockResolvedValue({ data: { session: { access_token: 't', user: {} } }, error: null });
    await handleExpiredSession('user-A', getSessionEpoch());

    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not sign out a different SDK user', async () => {
    const signOut = jest.fn();
    installClient(
      jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-B' } } }, error: null }),
      signOut
    );

    await handleExpiredSession('user-A', getSessionEpoch());
    expect(signOut).not.toHaveBeenCalled();
  });

  it('drops the result when the owner changes while getSession is in flight', async () => {
    const gate = deferred<{ data: { session: { user: { id: string } } }; error: null }>();
    const signOut = jest.fn();
    installClient(jest.fn().mockReturnValue(gate.promise), signOut);

    const pending = handleExpiredSession('user-A', getSessionEpoch());
    setAuthScope('user-B');
    bumpSessionEpoch();
    gate.resolve({ data: { session: { user: { id: 'user-A' } } }, error: null });
    await pending;

    expect(signOut).not.toHaveBeenCalled();
  });

  it('routes signOut through the shared auth queue and re-checks epoch once it runs', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    installClient(
      jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-A' } } }, error: null }),
      signOut
    );

    const blocker = deferred();
    const blocked = enqueueAuthOp(() => blocker.promise);
    const pending = handleExpiredSession('user-A', getSessionEpoch());

    await new Promise((resolve) => setImmediate(resolve));
    expect(signOut).not.toHaveBeenCalled(); // still queued behind the earlier auth op

    // A sign-out/user switch lands while we wait in the queue
    setAuthScope('user-B');
    bumpSessionEpoch();
    blocker.resolve();
    await blocked;
    await pending;

    expect(signOut).not.toHaveBeenCalled();
  });

  it('runs concurrent expired-session handlers as a single sign-out', async () => {
    const signOut = jest.fn().mockResolvedValue({ error: null });
    installClient(
      jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-A' } } }, error: null }),
      signOut
    );

    const epoch = getSessionEpoch();
    await Promise.all([handleExpiredSession('user-A', epoch), handleExpiredSession('user-A', epoch)]);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
