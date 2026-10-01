import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { setSupabaseClientForTesting } from '../supabase';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('AuthProvider queued operations re-check state at execution time', () => {
  let authStateCallback: ((event: string, session: unknown) => void) | null = null;
  const mockSignInWithPassword = jest.fn();
  const mockSignOut = jest.fn();
  const mockSignUp = jest.fn();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
        resend: jest.fn(),
        resetPasswordForEmail: jest.fn(),
      },
    } as unknown as Parameters<typeof setSupabaseClientForTesting>[0]);
  });

  afterAll(() => {
    setSupabaseClientForTesting(null);
  });

  it('a sign-in queued before a sign-out never runs after it and cannot resurrect the session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    // First sign-in is in flight at the SDK boundary and blocks the shared auth queue
    const firstSignIn = deferred<unknown>();
    mockSignInWithPassword.mockReturnValueOnce(firstSignIn.promise);

    let first!: Promise<void>;
    let second!: Promise<void>;
    let out!: Promise<void>;
    await act(async () => {
      first = result.current.signIn('owner-a@example.com', 'pw');
    });
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    await act(async () => {
      // Second sign-in (old state) is queued behind the first, then the user signs out
      second = result.current.signIn('owner-b@example.com', 'pw');
      out = result.current.signOut();
    });

    await act(async () => {
      firstSignIn.resolve({ data: {}, error: null });
      await Promise.all([first, second, out]);
    });

    // The queued sign-in was superseded by the sign-out: no SDK call for owner B
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(mockSignInWithPassword).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner-b@example.com' })
    );
    // The sign-out still ran
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('signedOut');
  });

  it('a sign-up queued before a sign-out is rejected instead of reporting a confirmation email', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    const firstSignIn = deferred<unknown>();
    mockSignInWithPassword.mockReturnValueOnce(firstSignIn.promise);

    let first!: Promise<void>;
    let signUp!: Promise<unknown>;
    let out!: Promise<void>;
    await act(async () => {
      first = result.current.signIn('owner-a@example.com', 'pw');
    });
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    await act(async () => {
      signUp = result.current.signUp('new@example.com', 'pw');
      signUp.catch(() => undefined);
      out = result.current.signOut();
    });

    await act(async () => {
      firstSignIn.resolve({ data: {}, error: null });
      await Promise.all([first, out]);
    });

    await expect(signUp).rejects.toThrow();
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('a queued sign-out still signs out the signed-in owner', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: { id: 'owner-a', email: 'a@example.com' } });
    });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    const blocker = deferred<unknown>();
    mockSignInWithPassword.mockReturnValueOnce(blocker.promise);

    let blocked!: Promise<void>;
    let out!: Promise<void>;
    await act(async () => {
      blocked = result.current.signIn('a@example.com', 'pw');
    });
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    await act(async () => {
      out = result.current.signOut();
    });

    await act(async () => {
      blocker.resolve({ data: {}, error: null });
      await Promise.all([blocked, out]);
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('signedOut');
  });
  describe('signOut local fallback after the primary sign-out fails', () => {
    const signInAs = async (result: { current: ReturnType<typeof useAuth> }, id: string) => {
      await act(async () => {
        authStateCallback?.('SIGNED_IN', { user: { id, email: `${id}@example.com` } });
      });
      await waitFor(() => expect(result.current.status).toBe('signedIn'));
    };

    it('still runs the local sign-out once when an SDK event re-publishes the same owner meanwhile', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.status).toBe('signedOut'));
      await signInAs(result, 'owner-a');

      const primary = deferred<unknown>();
      mockSignOut.mockReturnValueOnce(primary.promise);

      let out!: Promise<void>;
      await act(async () => {
        out = result.current.signOut();
      });
      expect(mockSignOut).toHaveBeenCalledTimes(1);

      await act(async () => {
        authStateCallback?.('TOKEN_REFRESHED', { user: { id: 'owner-a', email: 'owner-a@example.com' } });
        primary.resolve({ error: { message: 'network' } });
        await out;
      });

      expect(mockSignOut).toHaveBeenCalledTimes(2);
      expect(mockSignOut).toHaveBeenLastCalledWith({ scope: 'local' });
    });

    it('does not run the local sign-out when a different owner appeared meanwhile', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.status).toBe('signedOut'));
      await signInAs(result, 'owner-a');

      const primary = deferred<unknown>();
      mockSignOut.mockReturnValueOnce(primary.promise);

      let out!: Promise<void>;
      await act(async () => {
        out = result.current.signOut();
      });

      await act(async () => {
        authStateCallback?.('SIGNED_IN', { user: { id: 'owner-b', email: 'owner-b@example.com' } });
        primary.resolve({ error: { message: 'network' } });
        await out;
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('signedIn');
    });
  });
});
