import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import ProfileScreen, { getInitials } from '../(app)/profile';
import MoreScreen from '../(app)/(tabs)/more';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider, useAuth } from '../../auth/AuthProvider';
import type { AuthContextValue } from '../../auth/AuthProvider';
import { getSessionEpoch } from '../../auth/authScope';
import { setSupabaseClientForTesting, getSupabaseClient } from '../../auth/supabase';
import { createTestQueryClient, setNetworkOnline, resetNetworkOnline } from '../../test/testQueryClient';
import { MockHttpServer, defaultMockPreferences } from '../../test/mockServer';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
}));

describe('ProfileScreen', () => {
  let mockServer: MockHttpServer;
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let mockUpdateUser: jest.Mock;
  let mockResetPasswordForEmail: jest.Mock;
  let authStateCallback: ((event: string, session: any) => void) | null = null;
  let currentSession: any = null;

  const mockUserA = {
    id: 'user-profile-A',
    email: 'sarah@chenstudio.co',
    user_metadata: { name: 'Sarah Chen' },
  };

  const mockUserB = {
    id: 'user-profile-B',
    email: 'marcus@wright.co',
    user_metadata: { name: 'Marcus Wright' },
  };

  const setupProviders = (initialLocale: 'en' | 'ar' = 'en', screen: React.ReactElement = <ProfileScreen />) => {
    const initialMetrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    };

    return render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider initialPreference="light">
              <I18nProvider initialLocale={initialLocale}>
                {screen}
              </I18nProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetNetworkOnline();
    authStateCallback = null;

    currentSession = {
      user: { ...mockUserA },
      access_token: 'fake-token-A',
    };

    mockServer = new MockHttpServer();
    mockServer.reset({
      preferences: {
        ...defaultMockPreferences,
        name: 'Sarah Chen',
        email: 'sarah@chenstudio.co',
        currency: 'USD',
      },
    });

    global.fetch = jest.fn((url: any, init?: any) => mockServer.fetchHandler(url, init));
    queryClient = createTestQueryClient();

    mockUpdateUser = jest.fn().mockImplementation(async (attrs: any) => {
      const updatedUser = {
        ...currentSession.user,
        user_metadata: { ...currentSession.user.user_metadata, ...attrs.data },
      };
      currentSession = {
        ...currentSession,
        user: updatedUser,
      };
      // SDK boundary emits USER_UPDATED to real AuthProvider listener
      authStateCallback?.('USER_UPDATED', currentSession);
      return {
        data: { user: updatedUser },
        error: null,
      };
    });

    mockResetPasswordForEmail = jest.fn().mockResolvedValue({ error: null });

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
        updateUser: mockUpdateUser,
        resetPasswordForEmail: mockResetPasswordForEmail,
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
    queryClient.clear();
    resetNetworkOnline();
  });

  it('correctly calculates initials from name or email', () => {
    expect(getInitials('Sarah Chen')).toBe('SC');
    expect(getInitials('Sarah')).toBe('SA');
    expect(getInitials('', 'sarah@example.com')).toBe('SA');
    expect(getInitials(null, null)).toBe('HU');
  });

  it('renders avatar initials, editable name, read-only email, and security section', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-avatar-initials').props.children).toBe('SC');
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
      expect(getByTestId('profile-email-input').props.value).toBe('sarah@chenstudio.co');
      expect(getByTestId('profile-email-input').props.editable).toBe(false);
      expect(getByTestId('profile-change-password-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('profile-back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('validates empty/whitespace name with visible error and zero SDK/HTTP calls', async () => {
    const { getByTestId, getByText } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    // Clear name
    fireEvent.changeText(getByTestId('profile-name-input'), '   ');
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(getByText('Name cannot be empty.')).toBeTruthy();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(0);
  });

  it('synchronous duplicate lock blocks rapid batched save events in single act', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    fireEvent.changeText(getByTestId('profile-name-input'), 'Sarah Connor');

    // Rapid double-press before React re-renders isSaving state
    fireEvent.press(getByTestId('profile-save-button'));
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(getByTestId('profile-success-banner')).toBeTruthy();
    });

    // Exactly one SDK update and one PATCH call
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(1);
  });

  it('saves updated name via Supabase SDK emitting USER_UPDATED and updates More greeting display', async () => {
    // Render profile and save
    const profileView = setupProviders();

    await waitFor(() => {
      expect(profileView.getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    fireEvent.changeText(profileView.getByTestId('profile-name-input'), 'Sarah Connor');
    fireEvent.press(profileView.getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { name: 'Sarah Connor' } });
      expect(profileView.getByTestId('profile-success-banner')).toBeTruthy();
    });

    profileView.unmount();

    // Now render MoreScreen with the same QueryClient and AuthProvider session
    const moreView = setupProviders('en', <MoreScreen />);

    await waitFor(() => {
      // MoreScreen reflects updated user_metadata.name published by real AuthProvider listener!
      expect(moreView.getByTestId('more-user-name').props.children).toBe('Sarah Connor');
    });
  });

  it('when Supabase SDK updateUser fails, displays error and fires ZERO preferences PATCH', async () => {
    mockUpdateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Auth session expired' },
    });

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    fireEvent.changeText(getByTestId('profile-name-input'), 'Sarah Connor');
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
      expect(getByTestId('profile-error-banner')).toBeTruthy();
    });

    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(0);
  });

  it('handles partial failure honestly when SDK succeeds but preferences PATCH fails, allowing retry', async () => {
    const { getByTestId, queryByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    // Make PATCH preferences fail
    mockServer.setError('/api/user/preferences', 500, { error: 'Server error' });

    fireEvent.changeText(getByTestId('profile-name-input'), 'Sarah Connor');
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { name: 'Sarah Connor' } });
      // Honest partial error banner displayed
      expect(getByTestId('profile-error-banner')).toBeTruthy();
      // No false atomic success claim
      expect(queryByTestId('profile-success-banner')).toBeNull();
    });

    // Clear server error and retry
    mockServer.reset();
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(getByTestId('profile-success-banner')).toBeTruthy();
    });
  });

  it('deferred SDK save aborted on account switch: zero followup write to B, clean B state', async () => {
    let resolveSdkUpdate: (val: any) => void = () => {};
    const deferredSdkPromise = new Promise<any>((resolve) => {
      resolveSdkUpdate = resolve;
    });

    mockUpdateUser.mockReturnValueOnce(deferredSdkPromise);

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    // User A edits and initiates save
    fireEvent.changeText(getByTestId('profile-name-input'), 'Sarah Modified');
    fireEvent.press(getByTestId('profile-save-button'));

    // Wait until SDK updateUser has actually been called with User A's input
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { name: 'Sarah Modified' } });
    });

    // While SDK update is in-flight, account switches to User B!
    await act(async () => {
      currentSession = {
        user: { ...mockUserB },
        access_token: 'fake-token-B',
      };
      authStateCallback?.('SIGNED_IN', currentSession);
    });

    // Now let User A's deferred SDK call settle and drain
    await act(async () => {
      resolveSdkUpdate({
        data: { user: { ...mockUserA, user_metadata: { name: 'Sarah Modified' } } },
        error: null,
      });
      await new Promise((r) => setTimeout(r, 20));
    });

    // Fences must guarantee ZERO PATCH requests were sent under User B!
    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(0);

    // Profile input must reflect clean User B name, not User A's modified draft
    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Marcus Wright');
    });
  });

  it('when updateUser returns a mismatched user id, fails closed with localized error and fires zero preferences PATCH', async () => {
    mockUpdateUser.mockResolvedValueOnce({
      data: {
        user: { id: 'wrong-user-id', user_metadata: { name: 'Compromised Name' } },
      },
      error: null,
    });

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
    });

    fireEvent.changeText(getByTestId('profile-name-input'), 'Sarah Connor');
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
      expect(getByTestId('profile-error-banner')).toBeTruthy();
    });

    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(0);
  });

  it('same-owner USER_UPDATED and TOKEN_REFRESHED preserves session epoch', async () => {
    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-name-input')).toBeTruthy();
    });

    const initialEpoch = getSessionEpoch();

    // Emit same-owner USER_UPDATED
    await act(async () => {
      authStateCallback?.('USER_UPDATED', currentSession);
    });
    expect(getSessionEpoch()).toBe(initialEpoch);

    // Emit same-owner TOKEN_REFRESHED
    await act(async () => {
      authStateCallback?.('TOKEN_REFRESHED', currentSession);
    });
    expect(getSessionEpoch()).toBe(initialEpoch);
  });

  it('sends password reset email with synchronous duplicate exclusion and success banner', async () => {
    let resolveReset: (val: any) => void = () => {};
    const deferredReset = new Promise<any>((resolve) => {
      resolveReset = resolve;
    });
    mockResetPasswordForEmail.mockReturnValueOnce(deferredReset);

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-change-password-button')).toBeTruthy();
    });

    // Rapid double press while first reset is in-flight
    fireEvent.press(getByTestId('profile-change-password-button'));
    fireEvent.press(getByTestId('profile-change-password-button'));

    // Wait until resetPassword has been invoked at the SDK boundary
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    });

    // Settle the deferred reset
    await act(async () => {
      resolveReset({ error: null });
      await new Promise((r) => setTimeout(r, 20));
    });

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'sarah@chenstudio.co',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
      );
      expect(getByTestId('profile-security-banner')).toBeTruthy();
    });
  });

  it('blocks writes when offline at real onlineManager and reconnect causes zero automatic replay', async () => {
    setNetworkOnline(false);

    const { getByTestId } = setupProviders();

    await waitFor(() => {
      expect(getByTestId('profile-offline-banner')).toBeTruthy();
      expect(getByTestId('profile-name-input').props.editable).toBe(false);
    });

    // Attempting to press Save while offline fails closed
    fireEvent.press(getByTestId('profile-save-button'));
    expect(mockUpdateUser).not.toHaveBeenCalled();

    // Now reconnect to network
    act(() => {
      setNetworkOnline(true);
    });

    // Reconnecting causes ZERO automatic replay
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    const patchReqs = mockServer.getRequests().filter((r) => r.method === 'PATCH');
    expect(patchReqs).toHaveLength(0);

    // Fresh intentional user action succeeds
    fireEvent.changeText(getByTestId('profile-name-input'), 'Sarah Reconnected');
    fireEvent.press(getByTestId('profile-save-button'));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { name: 'Sarah Reconnected' } });
      expect(getByTestId('profile-success-banner')).toBeTruthy();
    });
  });

  describe('save races across owner switch, sign-out and the shared auth queue', () => {
    const deferred = <T,>() => {
      let resolve!: (v: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    };

    const sdk = () => getSupabaseClient().auth as unknown as Record<string, jest.Mock>;
    const patchCount = () => mockServer.getRequests().filter((r) => r.method === 'PATCH').length;
    const saveDisabled = (view: ReturnType<typeof setupProviders>) =>
      Boolean(view.getByTestId('profile-save-button').props.accessibilityState?.disabled);

    const startSave = async (view: ReturnType<typeof setupProviders>, name = 'Sarah Modified') => {
      await waitFor(() => {
        expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen');
      });
      fireEvent.changeText(view.getByTestId('profile-name-input'), name);
      fireEvent.press(view.getByTestId('profile-save-button'));
    };

    const switchToB = async () => {
      await act(async () => {
        currentSession = { user: { ...mockUserB }, access_token: 'fake-token-B' };
        authStateCallback?.('SIGNED_IN', currentSession);
      });
    };

    it('owner switches while preflight getSession is pending: no updateUser, no PATCH, B stays clean and can save', async () => {
      const preflight = deferred<unknown>();
      const view = setupProviders();
      await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
      sdk().getSession.mockReturnValueOnce(preflight.promise);

      await startSave(view);
      await switchToB();

      await act(async () => {
        preflight.resolve({ data: { session: { user: { ...mockUserA } } }, error: null });
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(patchCount()).toBe(0);
      expect(view.queryByTestId('profile-error-banner')).toBeNull();
      expect(view.queryByTestId('profile-success-banner')).toBeNull();
      await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Marcus Wright'));
      expect(saveDisabled(view)).toBe(false);
    });

    it('sign-out while preflight getSession is pending: no updateUser and no stale message', async () => {
      const preflight = deferred<unknown>();
      const view = setupProviders();
      await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
      sdk().getSession.mockReturnValueOnce(preflight.promise);

      await startSave(view);
      await act(async () => {
        currentSession = null;
        authStateCallback?.('SIGNED_OUT', null);
      });

      await act(async () => {
        preflight.resolve({ data: { session: { user: { ...mockUserA } } }, error: null });
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(patchCount()).toBe(0);
      expect(view.queryByTestId('profile-error-banner')).toBeNull();
    });

    it('null preflight session: no crash, no updateUser, clear error and the save can be retried', async () => {
      const view = setupProviders();
      await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
      sdk().getSession.mockResolvedValueOnce({ data: { session: null }, error: null });

      await startSave(view);

      await waitFor(() => expect(view.getByTestId('profile-error-banner')).toBeTruthy());
      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(patchCount()).toBe(0);
      expect(saveDisabled(view)).toBe(false);

      fireEvent.press(view.getByTestId('profile-save-button'));
      await waitFor(() => expect(view.getByTestId('profile-success-banner')).toBeTruthy());
      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    });

    it('preflight session without a user: fails closed with an error and no updateUser', async () => {
      const view = setupProviders();
      await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
      sdk().getSession.mockResolvedValueOnce({ data: { session: { access_token: 'x' } }, error: null });

      await startSave(view);

      await waitFor(() => expect(view.getByTestId('profile-error-banner')).toBeTruthy());
      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(saveDisabled(view)).toBe(false);
    });

    it('unmount while preflight getSession is pending: no updateUser, no PATCH', async () => {
      const preflight = deferred<unknown>();
      const view = setupProviders();
      await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
      sdk().getSession.mockReturnValueOnce(preflight.promise);

      await startSave(view);
      view.unmount();

      await act(async () => {
        preflight.resolve({ data: { session: { user: { ...mockUserA } } }, error: null });
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(patchCount()).toBe(0);
    });

    describe('with a concurrent auth op holding the shared queue', () => {
      let auth: AuthContextValue | null;
      let signInGate: ReturnType<typeof deferred<unknown>>;

      const AuthProbe = () => {
        auth = useAuth();
        return null;
      };

      const renderWithProbe = () =>
        setupProviders(
          'en',
          <>
            <AuthProbe />
            <ProfileScreen />
          </>
        );

      beforeEach(() => {
        auth = null;
        signInGate = deferred<unknown>();
        sdk().signInWithPassword = jest.fn().mockReturnValueOnce(signInGate.promise);
      });

      const holdQueue = async () => {
        await act(async () => {
          // Floating: settles when the test releases the gate
          auth!.signIn('sarah@chenstudio.co', 'pw').catch(() => undefined);
        });
        expect(sdk().signInWithPassword).toHaveBeenCalledTimes(1);
      };

      it('updateUser is serialized behind the in-flight auth op', async () => {
        const view = renderWithProbe();
        await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
        await holdQueue();

        await startSave(view);
        // Preflight has settled, but updateUser must wait for the queue
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        expect(mockUpdateUser).not.toHaveBeenCalled();

        await act(async () => {
          signInGate.resolve({ data: {}, error: null });
        });

        await waitFor(() => expect(view.getByTestId('profile-success-banner')).toBeTruthy());
        expect(mockUpdateUser).toHaveBeenCalledTimes(1);
        expect(patchCount()).toBe(1);
      });

      it('owner switches while updateUser waits in the queue: updateUser never runs for the old owner', async () => {
        const view = renderWithProbe();
        await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Sarah Chen'));
        await holdQueue();

        await startSave(view);
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        expect(mockUpdateUser).not.toHaveBeenCalled();

        await switchToB();
        await act(async () => {
          signInGate.resolve({ data: {}, error: null });
          await new Promise((r) => setTimeout(r, 20));
        });

        expect(mockUpdateUser).not.toHaveBeenCalled();
        expect(patchCount()).toBe(0);
        expect(view.queryByTestId('profile-error-banner')).toBeNull();
        expect(view.queryByTestId('profile-success-banner')).toBeNull();
        await waitFor(() => expect(view.getByTestId('profile-name-input').props.value).toBe('Marcus Wright'));
        expect(saveDisabled(view)).toBe(false);
      });
    });
  });
});
