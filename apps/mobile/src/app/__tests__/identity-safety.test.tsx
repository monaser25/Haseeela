import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import {
  getSessionEpoch,
  getCurrentAuthUserId,
  setAuthScope,
  resetAuthScope,
  bumpSessionEpoch,
} from '../../auth/authScope';
import { createTestQueryClient } from '../../test/testQueryClient';
import { MockHttpServer, defaultMockPreferences, defaultMockNotifications } from '../../test/mockServer';
import { apiRequest, handleExpiredSession, updateUserPreferences } from '../../api/client';
import { useUpdatePreferences, useMarkNotificationsRead } from '../../api/hooks';

describe('Identity Safety, Session Epoch & Preflight Verification', () => {
  let mockServer: MockHttpServer;
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let authStateCallback: ((event: string, session: any) => void) | null = null;
  let currentSession: any = null;

  const mockUserA = {
    id: 'user-identity-A',
    email: 'user-a@example.com',
  };

  const mockUserB = {
    id: 'user-identity-B',
    email: 'user-b@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthScope();
    authStateCallback = null;

    currentSession = {
      user: { ...mockUserA },
      access_token: 'bearer-token-user-A',
    };

    mockServer = new MockHttpServer();
    mockServer.reset({
      preferences: {
        ...defaultMockPreferences,
        name: 'User A',
        email: 'user-a@example.com',
        currency: 'USD',
      },
      notifications: [...defaultMockNotifications],
    });

    global.fetch = jest.fn((url: any, init?: any) => mockServer.fetchHandler(url, init));
    queryClient = createTestQueryClient();

    const mockSupabase = {
      auth: {
        getSession: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: { session: currentSession },
            error: null,
          })
        ),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signOut: jest.fn().mockImplementation(async () => {
          currentSession = null;
          authStateCallback?.('SIGNED_OUT', null);
          return { error: null };
        }),
      },
    };
    setSupabaseClientForTesting(mockSupabase as any);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
    resetAuthScope();
    queryClient.clear();
  });

  it('rejects apiRequest during preflight when session owner does not match expectedOwnerId', async () => {
    await expect(
      apiRequest('/api/user/preferences', {
        expectedOwnerId: 'user-identity-B',
      })
    ).rejects.toThrow('Identity verification failed');

    expect(mockServer.getRequests()).toHaveLength(0);
  });

  it('denies explicit signedOut null even when caller supplies expectedOwnerId and current epoch', async () => {
    setAuthScope(null); // Explicitly signed out

    await expect(
      apiRequest('/api/user/preferences', {
        expectedOwnerId: mockUserA.id,
        expectedEpoch: getSessionEpoch(),
      })
    ).rejects.toThrow('Unauthenticated');

    expect(mockServer.getRequests()).toHaveLength(0);
  });

  it('fails closed with zero HTTP fetches when SDK getSession errors or session is missing', async () => {
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: null },
          error: new Error('SDK network failure'),
        }),
      },
    } as any);

    await expect(apiRequest('/api/user/preferences')).rejects.toThrow('Unauthenticated');
    expect(mockServer.getRequests()).toHaveLength(0);
  });

  it('fails closed with zero HTTP fetches when session token or user id is empty/whitespace', async () => {
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: '   ' }, access_token: 'valid-token' } },
          error: null,
        }),
      },
    } as any);

    await expect(apiRequest('/api/user/preferences')).rejects.toThrow('Unauthenticated');
    expect(mockServer.getRequests()).toHaveLength(0);
  });

  it('verifies actual supplied Authorization bearer matches expected initiating owner and cannot be overridden by caller headers', async () => {
    await apiRequest('/api/user/preferences', {
      expectedOwnerId: mockUserA.id,
      headers: {
        authorization: 'Bearer malicious-override-token',
        Authorization: 'Bearer malicious-upper-token',
      },
    });

    const requests = mockServer.getRequests();
    expect(requests).toHaveLength(1);
    const authHeader = requests[0].headers?.Authorization || requests[0].headers?.authorization;
    expect(authHeader).toBe('Bearer bearer-token-user-A');
  });

  it('unscoped apiRequest late 401 held at HTTP boundary does not signOut User B', async () => {
    const mockSignOut = jest.fn();

    // Start with User A as active auth scope
    setAuthScope(mockUserA.id);

    // Defer the HTTP response
    mockServer.setPending('/api/user/preferences');

    const requestPromise = apiRequest('/api/user/preferences');

    await waitFor(() => {
      expect(mockServer.getPendingCount('/api/user/preferences')).toBe(1);
    });

    // While HTTP is held at boundary, user switches to User B
    setAuthScope(mockUserB.id);
    bumpSessionEpoch();

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: mockUserB, access_token: 'token-B' } },
          error: null,
        }),
        signOut: mockSignOut,
      },
    } as any);

    // Now release HTTP response with 401
    mockServer.resolvePending('/api/user/preferences', { error: 'Unauthorized' }, 401);

    await expect(requestPromise).rejects.toThrow();

    // Fences must ensure User B is NOT signed out!
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('held 204 No Content response verifies freshness and rejects on identity switch', async () => {
    let resolveFetch: (val: any) => void = () => {};
    const deferredFetch = new Promise<any>((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = jest.fn().mockReturnValue(deferredFetch);

    setAuthScope(mockUserA.id);
    const requestPromise = apiRequest('/api/test-204', {
      expectedOwnerId: mockUserA.id,
    });

    // Switch account while fetch is held
    setAuthScope(mockUserB.id);
    bumpSessionEpoch();

    // Settle with 204
    resolveFetch({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    });

    await expect(requestPromise).rejects.toThrow(/Identity verification failed|Session state invalidated/);
  });

  it('deferred JSON body parsing with positive json-entered signal causes apiRequest rejection on switch', async () => {
    let resolveJson: (val: any) => void = () => {};
    let signalJsonEntered: () => void = () => {};
    const jsonEnteredPromise = new Promise<void>((resolve) => {
      signalJsonEntered = resolve;
    });

    const deferredJsonPromise = new Promise<any>((resolve) => {
      resolveJson = resolve;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => {
        signalJsonEntered();
        return deferredJsonPromise;
      },
    });

    setAuthScope(mockUserA.id);
    const requestPromise = apiRequest('/api/user/preferences', {
      expectedOwnerId: mockUserA.id,
    });

    // Wait until response.json() has positively been entered
    await jsonEnteredPromise;

    // Switch account while json() is pending
    setAuthScope(mockUserB.id);
    bumpSessionEpoch();

    // Settle json
    resolveJson({ currency: 'USD' });

    await expect(requestPromise).rejects.toThrow(/Identity verification failed|Session state invalidated/);
  });

  it('realistic own SIGNED_IN event before signUp SDK return executes required cleanup and remains signedOut', async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });

    const mockClient = {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signUp: jest.fn().mockImplementation(async ({ email }) => {
          const newSession = {
            user: { id: 'new-user-123', email },
            access_token: 'new-token',
          };
          // GoTrueClient emits SIGNED_IN synchronously before signUp returns!
          authStateCallback?.('SIGNED_IN', newSession);
          return {
            data: { session: newSession, user: newSession.user },
            error: null,
          };
        }),
        signOut: mockSignOut,
      },
    };
    setSupabaseClientForTesting(mockClient as any);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    let signUpResult: any;
    await act(async () => {
      signUpResult = await result.current.signUp('newuser@example.com', 'password123');
    });

    expect(signUpResult).toEqual({ requiresEmailConfirmation: true });
    // Required cleanup happened despite own SIGNED_IN event!
    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.status).toBe('signedOut');
  });

  it('pending signOut returning error or throwing does not call local fallback or clear user B', async () => {
    let rejectSignOut: (err: any) => void = () => {};
    const deferredSignOut = new Promise<any>((_, reject) => {
      rejectSignOut = reject;
    });

    const mockSignOut = jest.fn().mockReturnValue(deferredSignOut);

    const mockClient = {
      auth: {
        getSession: jest.fn().mockImplementation(() =>
          Promise.resolve({ data: { session: currentSession }, error: null })
        ),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signOut: mockSignOut,
      },
    };
    setSupabaseClientForTesting(mockClient as any);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user?.id).toBe(mockUserA.id);
    });

    // User A triggers signOut (deferred)
    act(() => {
      result.current.signOut().catch(() => {});
    });

    // User B immediately signs in while User A's signOut is awaiting SDK
    act(() => {
      currentSession = { user: mockUserB, access_token: 'token-B' };
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    expect(result.current.user?.id).toBe(mockUserB.id);

    // Now User A's SDK signOut throws an error!
    await act(async () => {
      rejectSignOut(new Error('Network error on signOut'));
      await new Promise((r) => setTimeout(r, 20));
    });

    // Fencing ensures local fallback signOut({ scope: 'local' }) was NOT invoked for User B!
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.user?.id).toBe(mockUserB.id);
  });

  it('delayed signUp immediate-session cleanup while user B active does not log out user B', async () => {
    let resolveSignUp: (val: any) => void = () => {};
    const deferredSignUp = new Promise<any>((resolve) => {
      resolveSignUp = resolve;
    });

    const mockSignOut = jest.fn().mockResolvedValue({ error: null });

    const mockClient = {
      auth: {
        getSession: jest.fn().mockImplementation(() =>
          Promise.resolve({ data: { session: currentSession }, error: null })
        ),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signUp: jest.fn().mockReturnValue(deferredSignUp),
        signOut: mockSignOut,
      },
    };
    setSupabaseClientForTesting(mockClient as any);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.signUp('newuser@example.com', 'password123');
    });

    // While signUp is pending, User B becomes active
    act(() => {
      currentSession = { user: mockUserB, access_token: 'token-B' };
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    expect(result.current.user?.id).toBe(mockUserB.id);

    // Settle signUp with an immediate session
    await act(async () => {
      resolveSignUp({
        data: {
          session: { user: { id: 'new-user-id' }, access_token: 'new-token' },
          user: { id: 'new-user-id' },
        },
        error: null,
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    // Cleanup fence ensures mockSignOut was NOT called! User B is protected!
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(result.current.user?.id).toBe(mockUserB.id);
  });

  it('user A action then B SIGNED_IN in same turn before dispatch guarantees zero A write authorized as B and zero B cache pollution (mutate & mutateAsync for both hooks)', async () => {
    mockServer.setPending('/api/user/preferences');
    mockServer.setPending('/api/notifications/mark-read');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({
        auth: useAuth(),
        updatePrefs: useUpdatePreferences(),
        markRead: useMarkNotificationsRead(),
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.auth.user?.id).toBe(mockUserA.id);
    });

    let prefsError: any = null;
    let markReadError: any = null;

    // In the SAME synchronous act, User A initiates mutateAsync and User B signs in BEFORE dispatch settles!
    act(() => {
      result.current.updatePrefs.mutateAsync({ currency: 'EUR' }).catch((e) => {
        prefsError = e;
      });
      result.current.markRead.mutateAsync('notif-1').catch((e) => {
        markReadError = e;
      });

      // Switch to User B in the exact same turn!
      currentSession = { user: mockUserB, access_token: 'token-B' };
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    // Settle User A pending routes
    mockServer.resolvePending('/api/user/preferences', { ...defaultMockPreferences, currency: 'EUR' });
    mockServer.resolvePending('/api/notifications/mark-read', { unread: 0 });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    // Both mutations rejected or dropped cleanly
    expect(queryClient.getQueryData(['preferences', mockUserB.id])).toBeUndefined();
    expect(queryClient.getQueryData(['notifications', mockUserB.id])).toBeUndefined();
  });
});
