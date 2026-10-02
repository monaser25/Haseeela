import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../../auth/supabase';
import { MockHttpServer } from '../../../test/mockServer';
import { PushRegistrar } from '../PushRegistrar';
import { readRegisteredToken } from '../pushStorage';
import { resetKnownPushTokens } from '../pushTokenMemory';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'proj-123' } } } },
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

type Permission = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
type PushToken = Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
type TestSession = { user: { id: string; email: string }; access_token: string } | null;
type SupabaseTestClient = Parameters<typeof setSupabaseClientForTesting>[0];

const permission = (status: string, granted: boolean, canAskAgain: boolean) =>
  ({ status, granted, canAskAgain, expires: 'never' }) as unknown as Permission;
const GRANTED = permission('granted', true, true);
const UNDETERMINED = permission('undetermined', false, true);
const DENIED = permission('denied', false, false);
const expoToken = (data: string): PushToken => ({ type: 'expo', data });

const userA = { id: 'push-user-A', email: 'a@example.com' };
const userB = { id: 'push-user-B', email: 'b@example.com' };
const sessionFor = (user: { id: string; email: string }): TestSession => ({
  user: { ...user },
  access_token: `token-${user.id}`,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const setIsDevice = (value: boolean) => {
  (Device as { isDevice: boolean }).isDevice = value;
};
const setExpoConfig = (value: unknown) => {
  (Constants as unknown as { expoConfig: unknown }).expoConfig = value;
};

describe('push registration', () => {
  let server: MockHttpServer;
  let authStateCallback: ((event: string, session: TestSession) => void) | null;
  let currentSession: TestSession;
  let signOutSdk: jest.Mock;
  let authApi: ReturnType<typeof useAuth>;

  function Harness() {
    authApi = useAuth();
    return <PushRegistrar />;
  }

  const mountApp = () =>
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

  const registerCalls = () => server.getRequests().filter((r) => r.path === '/api/devices/register');
  const unregisterCalls = () => server.getRequests().filter((r) => r.path === '/api/devices/unregister');
  const authHeader = (req: { headers?: Record<string, string> }) => req.headers?.Authorization;

  const switchTo = (session: TestSession) => {
    currentSession = session;
    act(() => authStateCallback?.('SIGNED_IN', session));
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    resetKnownPushTokens();
    setIsDevice(true);
    setExpoConfig({ version: '1.0.0', extra: { eas: { projectId: 'proj-123' } } });
    mockNotifications.getPermissionsAsync.mockResolvedValue(GRANTED);
    mockNotifications.requestPermissionsAsync.mockResolvedValue(GRANTED);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue(expoToken('ExponentPushToken[abc]'));

    authStateCallback = null;
    currentSession = sessionFor(userA);
    server = new MockHttpServer();
    server.reset();
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) =>
      server.fetchHandler(url, init)
    ) as unknown as typeof fetch;

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
    } as unknown as SupabaseTestClient);

    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setSupabaseClientForTesting(null);
  });

  it('registers once with the correct body, bearer token and a single permission prompt', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue(UNDETERMINED);
    const view = mountApp();

    await waitFor(() => expect(registerCalls()).toHaveLength(1));
    expect(registerCalls()[0].body).toEqual({ token: 'ExponentPushToken[abc]', platform: 'ios' });
    expect(authHeader(registerCalls()[0])).toBe(`Bearer token-${userA.id}`);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-123' });
    await waitFor(async () => expect(await readRegisteredToken(userA.id)).toBe('ExponentPushToken[abc]'));

    // A later launch with the same token does not register again
    view.unmount();
    mountApp();
    await waitFor(() => expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(2));
    expect(registerCalls()).toHaveLength(1);
  });

  it('re-registers when the token changed since the last launch', async () => {
    const view = mountApp();
    await waitFor(() => expect(registerCalls()).toHaveLength(1));
    await waitFor(async () => expect(await readRegisteredToken(userA.id)).toBe('ExponentPushToken[abc]'));
    view.unmount();

    mockNotifications.getExpoPushTokenAsync.mockResolvedValue(expoToken('ExponentPushToken[rotated]'));
    mountApp();

    await waitFor(() => expect(registerCalls()).toHaveLength(2));
    expect(registerCalls()[1].body.token).toBe('ExponentPushToken[rotated]');
  });

  it('sends the android platform and creates the default notification channel on android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mountApp();

    await waitFor(() => expect(registerCalls()).toHaveLength(1));
    expect(registerCalls()[0].body.platform).toBe('android');
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: 3 })
    );
  });

  it('does nothing before sign-in (no prompt, no request)', async () => {
    currentSession = null;
    mountApp();

    await waitFor(() => expect(authApi.status).toBe('signedOut'));
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registerCalls()).toHaveLength(0);
  });

  it('skips on a simulator / emulator', async () => {
    setIsDevice(false);
    mountApp();

    await waitFor(() => expect(authApi.status).toBe('signedIn'));
    await act(async () => {});
    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerCalls()).toHaveLength(0);
  });

  it('skips when permission was previously denied and never re-prompts', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue(DENIED);
    mountApp();

    await waitFor(() => expect(mockNotifications.getPermissionsAsync).toHaveBeenCalled());
    await act(async () => {});
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerCalls()).toHaveLength(0);
  });

  it('skips when the user denies the permission prompt', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue(UNDETERMINED);
    mockNotifications.requestPermissionsAsync.mockResolvedValue(DENIED);
    mountApp();

    await waitFor(() => expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerCalls()).toHaveLength(0);
  });

  it('skips without an EAS project id', async () => {
    setExpoConfig({ version: '1.0.0', extra: {} });
    mountApp();

    await waitFor(() => expect(authApi.status).toBe('signedIn'));
    await act(async () => {});
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerCalls()).toHaveLength(0);
  });

  it('does not register a token for a stale owner when the account changes during the permission prompt', async () => {
    const prompt = deferred<Permission>();
    mockNotifications.getPermissionsAsync.mockResolvedValue(UNDETERMINED);
    mockNotifications.requestPermissionsAsync.mockReturnValueOnce(prompt.promise);
    mockNotifications.getExpoPushTokenAsync
      .mockResolvedValueOnce(expoToken('ExponentPushToken[stale-A]'))
      .mockResolvedValue(expoToken('ExponentPushToken[fresh-B]'));
    mountApp();

    await waitFor(() => expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
    switchTo(sessionFor(userB));
    await act(async () => {
      prompt.resolve(GRANTED);
    });

    await waitFor(() => expect(registerCalls()).toHaveLength(1));
    await act(async () => {});
    expect(registerCalls()).toHaveLength(1);
    // The stale owner's flow never reached the token fetch
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(authHeader(registerCalls()[0])).toBe(`Bearer token-${userB.id}`);
    expect(await readRegisteredToken(userA.id)).toBeNull();
  });

  it('does not register a token for a stale owner when the account changes during the token fetch', async () => {
    const tokenFetch = deferred<PushToken>();
    mockNotifications.getExpoPushTokenAsync
      .mockReturnValueOnce(tokenFetch.promise)
      .mockResolvedValue(expoToken('ExponentPushToken[fresh-B]'));
    mountApp();

    await waitFor(() => expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1));
    switchTo(sessionFor(userB));
    await act(async () => {
      tokenFetch.resolve(expoToken('ExponentPushToken[stale-A]'));
    });

    await waitFor(() => expect(registerCalls()).toHaveLength(1));
    await act(async () => {});
    expect(registerCalls().map((r) => r.body.token)).toEqual(['ExponentPushToken[fresh-B]']);
    expect(authHeader(registerCalls()[0])).toBe(`Bearer token-${userB.id}`);
  });

  it('does not remember a registration that completes after the owner signed out', async () => {
    server.setPending('/api/devices/register', 'POST');
    mountApp();

    await waitFor(() => expect(server.getPendingCount('/api/devices/register', 'POST')).toBe(1));
    currentSession = null;
    act(() => authStateCallback?.('SIGNED_OUT', null));
    await act(async () => {
      server.resolvePending('/api/devices/register', { ok: true }, 200, 'POST');
    });

    await act(async () => {});
    expect(await readRegisteredToken(userA.id)).toBeNull();
  });

  describe('sign-out', () => {
    const registerAndWait = async () => {
      mountApp();
      await waitFor(async () => expect(await readRegisteredToken(userA.id)).toBe('ExponentPushToken[abc]'));
    };

    it('unregisters the outgoing owner token before the session is revoked and forgets it locally', async () => {
      await registerAndWait();
      let unregisterSeenBeforeSdkSignOut = false;
      signOutSdk.mockImplementation(async () => {
        unregisterSeenBeforeSdkSignOut = unregisterCalls().length === 1;
        currentSession = null;
        authStateCallback?.('SIGNED_OUT', null);
        return { error: null };
      });

      await act(async () => {
        await authApi.signOut();
      });

      expect(unregisterCalls()).toHaveLength(1);
      expect(unregisterCalls()[0].body).toEqual({ token: 'ExponentPushToken[abc]' });
      expect(authHeader(unregisterCalls()[0])).toBe(`Bearer token-${userA.id}`);
      expect(unregisterSeenBeforeSdkSignOut).toBe(true);
      expect(signOutSdk).toHaveBeenCalledTimes(1);
      expect(authApi.status).toBe('signedOut');
      await waitFor(async () => expect(await readRegisteredToken(userA.id)).toBeNull());
    });

    it('still completes sign-out when the unregister request fails with a server error', async () => {
      await registerAndWait();
      server.setError('/api/devices/unregister', 500, { error: 'boom' });

      await act(async () => {
        await authApi.signOut();
      });

      expect(unregisterCalls()).toHaveLength(1);
      expect(signOutSdk).toHaveBeenCalledTimes(1);
      expect(authApi.status).toBe('signedOut');
    });

    it('still completes sign-out when the network is down', async () => {
      await registerAndWait();
      (global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes('/api/devices/unregister')) {
          return Promise.reject(new TypeError('Network request failed'));
        }
        return server.fetchHandler(url, init);
      });

      await act(async () => {
        await authApi.signOut();
      });

      expect(signOutSdk).toHaveBeenCalledTimes(1);
      expect(authApi.status).toBe('signedOut');
      await waitFor(async () => expect(await readRegisteredToken(userA.id)).toBeNull());
    });

    it('sends nothing when no token was ever registered', async () => {
      setIsDevice(false);
      mountApp();
      await waitFor(() => expect(authApi.status).toBe('signedIn'));

      await act(async () => {
        await authApi.signOut();
      });

      expect(unregisterCalls()).toHaveLength(0);
      expect(signOutSdk).toHaveBeenCalledTimes(1);
    });
  });
});
