import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { setSupabaseClientForTesting } from '../supabase';
import * as queryModule from '../../query/queryClient';

describe('AuthProvider & useAuth', () => {
  let authStateCallback: ((event: string, session: any) => void) | null = null;
  const mockUnsubscribe = jest.fn();
  const mockSignInWithPassword = jest.fn();
  const mockSignUp = jest.fn();
  const mockResend = jest.fn();
  const mockResetPasswordForEmail = jest.fn();
  const mockSignOut = jest.fn();
  const mockGetSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    mockResend.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const mockClient = {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: jest.fn((callback) => {
          authStateCallback = callback;
          return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
        }),
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        resend: mockResend,
        resetPasswordForEmail: mockResetPasswordForEmail,
        signOut: mockSignOut,
      },
    };

    setSupabaseClientForTesting(mockClient as any);
  });

  afterAll(() => {
    setSupabaseClientForTesting(null);
  });

  it('initializes with loading status and settles to signedOut when no session exists', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('signedOut');
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('settles to signedIn when existing session is restored', async () => {
    const mockUser = { id: 'usr-1', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'token-123' };

    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('signedIn');
    });

    expect(result.current.session).toEqual(mockSession);
    expect(result.current.user).toEqual(mockUser);
  });

  it('signIn invokes signInWithPassword with trimmed email', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn('  user@domain.com ', 'secret123');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@domain.com',
      password: 'secret123',
    });
  });

  it('signUp passes email, password, and name with correct emailRedirectTo', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      const res = await result.current.signUp('sarah@example.com', 'password123', 'Sarah Ahmed');
      expect(res).toEqual({ requiresEmailConfirmation: true });
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'sarah@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: 'http://10.0.2.2:3000/verify',
        data: { name: 'Sarah Ahmed' },
      },
    });
  });

  it('signUp signs out if an active session is returned immediately', async () => {
    const mockSession = { user: { id: 'new-user' }, access_token: 'new-token' };
    mockSignUp.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      const res = await result.current.signUp('sarah@example.com', 'password123');
      expect(res).toEqual({ requiresEmailConfirmation: true });
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.session).toBeNull();
    expect(result.current.status).toBe('signedOut');
  });

  it('resendConfirmation invokes supabase resend with signup type and verify redirectTo', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.resendConfirmation('sarah@example.com');
    });

    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'sarah@example.com',
      options: {
        emailRedirectTo: 'http://10.0.2.2:3000/verify',
      },
    });
  });

  it('resendConfirmation throws when supabase returns an error', async () => {
    const mockError = new Error('Too many requests');
    mockResend.mockResolvedValueOnce({ error: mockError });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await expect(
      act(async () => {
        await result.current.resendConfirmation('sarah@example.com');
      })
    ).rejects.toThrow('Too many requests');
  });

  it('resetPassword passes correct redirectTo', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.resetPassword('forgot@example.com');
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('forgot@example.com', {
      redirectTo: 'http://10.0.2.2:3000/reset-password',
    });
  });

  it('signOut invokes supabase signOut and clears query and persisted caches', async () => {
    const clearCacheSpy = jest.spyOn(queryModule, 'clearQueryAndPersistedCache').mockResolvedValue();

    const mockSession = { user: { id: 'usr-1' }, access_token: 'tok' };
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.status).toBe('signedOut');
    expect(result.current.session).toBeNull();
    expect(clearCacheSpy).toHaveBeenCalled();

    clearCacheSpy.mockRestore();
  });

  it('clears query and persisted caches when onAuthStateChange fires user change', async () => {
    const clearCacheSpy = jest.spyOn(queryModule, 'clearQueryAndPersistedCache').mockResolvedValue();

    const mockSession1 = { user: { id: 'user-A' } };
    mockGetSession.mockResolvedValueOnce({
      data: { session: mockSession1 },
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    // Trigger auth state change to another user
    const mockSession2 = { user: { id: 'user-B' } };
    await act(async () => {
      authStateCallback?.('SIGNED_IN', mockSession2);
    });

    expect(clearCacheSpy).toHaveBeenCalled();

    clearCacheSpy.mockRestore();
  });
});
