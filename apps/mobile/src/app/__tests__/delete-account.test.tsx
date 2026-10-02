import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeleteAccountScreen from '../(app)/delete-account';
import LoginScreen from '../(auth)/login';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider, useAuth } from '../../auth';
import { clearAccountDeletionNotice, getAccountDeletionNotice } from '../../auth/accountDeletionNotice';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import { usePreferences } from '../../api';
import { queryClient as appQueryClient, ASYNC_STORAGE_PERSISTER_KEY } from '../../query/queryClient';
import { setKnownPushToken, resetKnownPushTokens } from '../../services/push/pushTokenMemory';
import {
  createTestQueryClient,
  setNetworkOnline,
  resetNetworkOnline,
} from '../../test/testQueryClient';
import { MockHttpServer } from '../../test/mockServer';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

type TestSession = { user: { id: string; email: string }; access_token: string };

const sessionFor = (id: string): TestSession => ({
  user: { id, email: `${id}@example.com` },
  access_token: `token-${id}`,
});

const userA = 'user-delete-A';
const userB = 'user-delete-B';

const DELETE_PATH = '/api/user/delete';

describe('DeleteAccountScreen', () => {
  let server: MockHttpServer;
  let currentSession: TestSession | null;
  let authStateCallback: ((event: string, session: TestSession | null) => void) | null;
  let signOutSdk: jest.Mock;
  let testQueryClient: ReturnType<typeof createTestQueryClient>;

  /** Signed in -> the given screen; signed out -> the real login screen (shows the notice). */
  function Harness({ children }: { children?: React.ReactNode }) {
    const { status } = useAuth();
    if (status === 'signedIn') return <>{children ?? <DeleteAccountScreen />}</>;
    if (status === 'signedOut') return <LoginScreen />;
    return null;
  }

  const mount = (locale: 'en' | 'ar' = 'en', children?: React.ReactNode) =>
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <QueryClientProvider client={testQueryClient}>
          <ThemeProvider initialPreference="light">
            <I18nProvider initialLocale={locale}>
              <AuthProvider>
                <Harness>{children}</Harness>
              </AuthProvider>
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );

  const deleteRequests = () =>
    server.getRequests().filter((r) => r.method === 'DELETE' && r.path === DELETE_PATH);
  const unregisterRequests = () =>
    server.getRequests().filter((r) => r.path === '/api/devices/unregister');

  const ready = async (view: ReturnType<typeof mount>) => {
    await waitFor(() => expect(view.getByTestId('delete-account-screen')).toBeTruthy());
  };

  const typeConfirmation = (view: ReturnType<typeof mount>, word = 'DELETE') => {
    fireEvent.changeText(view.getByTestId('delete-account-confirm-input'), word);
  };

  const pressDelete = (view: ReturnType<typeof mount>) => {
    fireEvent.press(view.getByTestId('delete-account-confirm-button'));
  };

  const confirmDisabled = (view: ReturnType<typeof mount>) =>
    view.getByTestId('delete-account-confirm-button').props.accessibilityState.disabled;

  const expectSignedOutWithNotice = async (view: ReturnType<typeof mount>, text: string) => {
    await waitFor(() => expect(view.getByTestId('login-screen')).toBeTruthy());
    expect(view.getByTestId('login-account-deletion-banner')).toBeTruthy();
    expect(view.getByText(text)).toBeTruthy();
    expect(view.queryByTestId('delete-account-screen')).toBeNull();
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    act(() => {
      clearAccountDeletionNotice();
    });
    resetKnownPushTokens();
    act(() => {
      resetNetworkOnline();
    });
    await AsyncStorage.clear();
    appQueryClient.clear();

    authStateCallback = null;
    currentSession = sessionFor(userA);
    server = new MockHttpServer();
    server.reset();
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
      server.fetchHandler(url, init)
    ) as unknown as typeof fetch;
    testQueryClient = createTestQueryClient();

    signOutSdk = jest.fn(async () => {
      currentSession = null;
      authStateCallback?.('SIGNED_OUT', null);
      return { error: null };
    });
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: currentSession }, error: null })),
        onAuthStateChange: jest.fn((cb) => {
          authStateCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signOut: signOutSdk,
      },
    } as never);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
    testQueryClient.clear();
    act(() => {
      clearAccountDeletionNotice();
      resetNetworkOnline();
    });
  });

  describe('confirmation', () => {
    it('keeps the delete button disabled until the confirmation word is typed', async () => {
      const view = mount();
      await ready(view);

      expect(confirmDisabled(view)).toBe(true);

      typeConfirmation(view, 'DELET');
      expect(confirmDisabled(view)).toBe(true);

      typeConfirmation(view, ' delete ');
      expect(confirmDisabled(view)).toBe(false);
      expect(deleteRequests()).toHaveLength(0);
    });

    it('explains the consequences and uses the localized confirmation word in Arabic', async () => {
      const view = mount('ar');
      await ready(view);

      expect(view.getByText('لا يمكن التراجع عن هذا الإجراء')).toBeTruthy();
      expect(view.getByText('اكتب حذف للتأكيد')).toBeTruthy();

      typeConfirmation(view, 'DELETE');
      expect(confirmDisabled(view)).toBe(true);
      typeConfirmation(view, 'حذف');
      expect(confirmDisabled(view)).toBe(false);
    });

    it('is disabled offline with an explanation and sends nothing', async () => {
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      expect(confirmDisabled(view)).toBe(false);

      act(() => {
        setNetworkOnline(false);
      });

      await waitFor(() => expect(view.getByTestId('delete-account-offline-banner')).toBeTruthy());
      expect(view.getByText('You need an internet connection to delete your account.')).toBeTruthy();
      expect(confirmDisabled(view)).toBe(true);

      pressDelete(view);
      expect(deleteRequests()).toHaveLength(0);
    });
  });

  describe('completed deletion (200 ok)', () => {
    it('unregisters push for the owner, clears caches, signs out and shows the deleted message', async () => {
      setKnownPushToken(userA, 'ExponentPushToken[abc]');
      await AsyncStorage.setItem(ASYNC_STORAGE_PERSISTER_KEY, 'cached-owner-data');
      appQueryClient.setQueryData(['overview', userA], { secret: true });

      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);

      await expectSignedOutWithNotice(view, 'Your account has been deleted.');

      expect(deleteRequests()).toHaveLength(1);
      expect(deleteRequests()[0].headers?.Authorization).toBe(`Bearer token-${userA}`);
      expect(unregisterRequests()).toHaveLength(1);
      expect(unregisterRequests()[0].body).toEqual({ token: 'ExponentPushToken[abc]' });
      expect(unregisterRequests()[0].headers?.Authorization).toBe(`Bearer token-${userA}`);
      expect(signOutSdk).toHaveBeenCalledTimes(1);

      await waitFor(() => expect(appQueryClient.getQueryData(['overview', userA])).toBeUndefined());
      expect(await AsyncStorage.getItem(ASYNC_STORAGE_PERSISTER_KEY)).toBeNull();
    });

    it('shows the Arabic deleted message on the login screen', async () => {
      const view = mount('ar');
      await ready(view);
      typeConfirmation(view, 'حذف');
      pressDelete(view);

      await expectSignedOutWithNotice(view, 'تم حذف حسابك.');
    });

    it('clears the notice when the user starts signing in again', async () => {
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);
      await expectSignedOutWithNotice(view, 'Your account has been deleted.');

      fireEvent.press(view.getByTestId('login-submit-button'));

      await waitFor(() => expect(getAccountDeletionNotice()).toBeNull());
      expect(view.queryByTestId('login-account-deletion-banner')).toBeNull();
    });
  });

  describe('deletion in progress', () => {
    it.each([
      ['409 CLAIM_EXPIRED', 409, { error: 'Deletion in progress', code: 'CLAIM_EXPIRED', deletionPending: true }],
      ['500 FINANCE_CLEANUP_FAILED', 500, { error: 'Cleanup failed', code: 'FINANCE_CLEANUP_FAILED', deletionPending: true }],
      ['502 AUTH_DELETE_FAILED', 502, { error: 'Auth failed', code: 'AUTH_DELETE_FAILED', deletionPending: true }],
      ['502 gateway error without the backend contract', 502, 'Bad Gateway'],
    ])('signs out with the "being completed" message on %s', async (_label, status, body) => {
      server.setError(DELETE_PATH, status, body);
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);

      await expectSignedOutWithNotice(
        view,
        'Your account deletion is being completed. You have been signed out.'
      );
      expect(signOutSdk).toHaveBeenCalledTimes(1);
      expect(view.queryByText(/could not start deleting/i)).toBeNull();
    });

    it('treats a network failure after the request was sent as in progress, not as a failure', async () => {
      server.setNetworkFailure(DELETE_PATH, 'DELETE');
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);

      await expectSignedOutWithNotice(
        view,
        'Your account deletion is being completed. You have been signed out.'
      );
      expect(deleteRequests()).toHaveLength(1);
      expect(signOutSdk).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure before any deletion intent was recorded', () => {
    it('stays signed in on deletionPending: false, shows the error and lets the user retry', async () => {
      server.setErrorOnce(DELETE_PATH, 500, {
        error: 'Failed to record deletion',
        code: 'PERSISTENCE_FAILED',
        deletionPending: false,
      });
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);

      await waitFor(() => expect(view.getByTestId('delete-account-error-banner')).toBeTruthy());
      expect(
        view.getByText('We could not start deleting your account, so nothing was deleted. Please try again.')
      ).toBeTruthy();
      expect(signOutSdk).not.toHaveBeenCalled();
      expect(getAccountDeletionNotice()).toBeNull();
      expect(view.getByTestId('delete-account-screen')).toBeTruthy();
      await waitFor(() => expect(confirmDisabled(view)).toBe(false));

      // Retry succeeds
      pressDelete(view);
      await expectSignedOutWithNotice(view, 'Your account has been deleted.');
      expect(deleteRequests()).toHaveLength(2);
    });

    it('stays signed in and sends nothing when the session is gone before the request is dispatched', async () => {
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      currentSession = null;
      pressDelete(view);

      await waitFor(() => expect(view.getByTestId('delete-account-error-banner')).toBeTruthy());
      expect(deleteRequests()).toHaveLength(0);
      expect(signOutSdk).not.toHaveBeenCalled();
      expect(getAccountDeletionNotice()).toBeNull();
    });

    it('treats a plain 4xx rejection without deletion intent as a failure', async () => {
      server.setError(DELETE_PATH, 429, { error: 'Too many requests' });
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);

      await waitFor(() => expect(view.getByTestId('delete-account-error-banner')).toBeTruthy());
      expect(signOutSdk).not.toHaveBeenCalled();
    });
  });

  describe('single flight and identity fences', () => {
    it('sends exactly one DELETE when the button is activated twice before the first settles', async () => {
      server.setPending(DELETE_PATH, 'DELETE');
      const view = mount();
      await ready(view);
      typeConfirmation(view);

      // Both taps land on the same render (state updates are deferred until act exits), so only
      // the synchronous single-flight lock can stop the second one.
      act(() => {
        pressDelete(view);
        pressDelete(view);
      });

      await waitFor(() => expect(server.getPendingCount(DELETE_PATH, 'DELETE')).toBe(1));
      expect(deleteRequests()).toHaveLength(1);

      await act(async () => {
        server.resolvePending(DELETE_PATH, { ok: true }, 200, 'DELETE');
      });
      await expectSignedOutWithNotice(view, 'Your account has been deleted.');
      expect(deleteRequests()).toHaveLength(1);
    });

    it('applies nothing to a different owner when the account switches while DELETE is in flight', async () => {
      server.setPending(DELETE_PATH, 'DELETE');
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);
      await waitFor(() => expect(server.getPendingCount(DELETE_PATH, 'DELETE')).toBe(1));

      // User B signs in on this device while A's request is still pending
      currentSession = sessionFor(userB);
      act(() => {
        authStateCallback?.('SIGNED_IN', currentSession);
      });

      await act(async () => {
        server.resolvePending(DELETE_PATH, { ok: true }, 200, 'DELETE');
      });

      // B stays signed in, untouched: no sign-out, no notice, no stale loading/error state
      expect(signOutSdk).not.toHaveBeenCalled();
      expect(getAccountDeletionNotice()).toBeNull();
      expect(view.getByTestId('delete-account-screen')).toBeTruthy();
      expect(view.queryByTestId('login-screen')).toBeNull();
      expect(view.queryByTestId('delete-account-error-banner')).toBeNull();
      expect(view.getByTestId('delete-account-confirm-input').props.value).toBe('');
      expect(deleteRequests()).toHaveLength(1);
    });

    it('does not sign out a different owner when a failure for the previous owner arrives late', async () => {
      server.setPending(DELETE_PATH, 'DELETE');
      const view = mount();
      await ready(view);
      typeConfirmation(view);
      pressDelete(view);
      await waitFor(() => expect(server.getPendingCount(DELETE_PATH, 'DELETE')).toBe(1));

      currentSession = sessionFor(userB);
      act(() => {
        authStateCallback?.('SIGNED_IN', currentSession);
      });

      await act(async () => {
        server.resolvePending(
          DELETE_PATH,
          { error: 'Deletion in progress', code: 'CLAIM_EXPIRED', deletionPending: true },
          409,
          'DELETE'
        );
      });

      expect(signOutSdk).not.toHaveBeenCalled();
      expect(getAccountDeletionNotice()).toBeNull();
      expect(view.getByTestId('delete-account-screen')).toBeTruthy();
    });
  });

  describe('pending-deletion 403 from any other API call', () => {
    function PreferencesProbe() {
      usePreferences();
      return null;
    }

    it('signs out locally with the "being completed" message', async () => {
      server.setError('/api/user/preferences', 403, { error: 'Account is pending deletion' });
      const view = mount('en', <PreferencesProbe />);

      await expectSignedOutWithNotice(
        view,
        'Your account deletion is being completed. You have been signed out.'
      );
      expect(signOutSdk).toHaveBeenCalledTimes(1);
      expect(signOutSdk).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('ignores other 403 responses', async () => {
      server.setError('/api/user/preferences', 403, { error: 'Forbidden' });
      const view = mount('en', <PreferencesProbe />);

      await waitFor(() => expect(server.getRequestCount('GET', '/api/user/preferences')).toBe(1));
      await act(async () => {});
      expect(signOutSdk).not.toHaveBeenCalled();
      expect(getAccountDeletionNotice()).toBeNull();
      expect(view.queryByTestId('login-screen')).toBeNull();
    });
  });
});
