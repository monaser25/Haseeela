import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../../../auth/AuthProvider';
import { setSupabaseClientForTesting } from '../../../auth/supabase';
import { PushNavigationHandler, resolvePushPath } from '../PushNavigationHandler';

const mockPush = jest.fn();
let mockNavigationKey: string | undefined = 'root';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRootNavigationState: () => ({ key: mockNavigationKey }),
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

type TestResponse = Notifications.NotificationResponse;
type TestSession = { user: { id: string; email: string }; access_token: string } | null;
type SupabaseTestClient = Parameters<typeof setSupabaseClientForTesting>[0];

const makeResponse = (data: unknown, overrides: { id?: string; action?: string } = {}): TestResponse =>
  ({
    actionIdentifier: overrides.action ?? DEFAULT_ACTION,
    notification: {
      request: { identifier: overrides.id ?? `req-${Math.random()}`, content: { data } },
    },
  }) as unknown as TestResponse;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('push notification tap routing', () => {
  let responseListener: ((response: TestResponse) => void) | null;
  const signedInSession: TestSession = { user: { id: 'nav-user', email: 'n@example.com' }, access_token: 'tok' };

  const setAuth = (session: TestSession) => {
    configureSupabase(() => Promise.resolve(session));
  };

  const configureSupabase = (getSession: () => Promise<TestSession>) => {
    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: await getSession() }, error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signOut: jest.fn(async () => ({ error: null })),
      },
    } as unknown as SupabaseTestClient);
  };

  const mountHandler = () =>
    render(
      <AuthProvider>
        <PushNavigationHandler />
      </AuthProvider>
    );

  const tap = (response: TestResponse) => {
    act(() => responseListener?.(response));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationKey = 'root';
    responseListener = null;
    mockNotifications.addNotificationResponseReceivedListener.mockImplementation(((cb: (response: TestResponse) => void) => {
      responseListener = cb;
      return { remove: jest.fn() };
    }) as unknown as typeof Notifications.addNotificationResponseReceivedListener);
    mockNotifications.getLastNotificationResponse.mockReturnValue(null);
    setAuth(signedInSession);
  });

  afterEach(() => {
    setSupabaseClientForTesting(null);
  });

  it('shows pushes as a banner while the app is in the foreground', async () => {
    mountHandler();
    await act(async () => {});
    expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
    const handler = mockNotifications.setNotificationHandler.mock.calls[0][0] as unknown as { handleNotification: (n: unknown) => Promise<unknown> };
    await expect(handler.handleNotification({})).resolves.toEqual(
      expect.objectContaining({ shouldShowBanner: true, shouldShowList: true })
    );
  });

  it('navigates to an allowlisted static route on tap', async () => {
    mountHandler();
    await waitFor(() => expect(responseListener).not.toBeNull());
    // wait for auth to resolve before tapping so the tap is delivered immediately
    await act(async () => {});

    tap(makeResponse({ kind: 'billing_due', route: '/(app)/subscriptions' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions'));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('navigates to the notifications screen', async () => {
    mountHandler();
    await act(async () => {});

    tap(makeResponse({ kind: 'reminders', route: '/(app)/notifications' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/notifications'));
  });

  it('navigates to an invoice with its id', async () => {
    mountHandler();
    await act(async () => {});

    tap(makeResponse({ kind: 'invoice_overdue', route: '/(app)/invoice/[id]', params: { id: 'inv_42-A' } }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/invoice/inv_42-A'));
  });

  it.each([
    ['an unknown route', { route: '/(app)/settings' }],
    ['an external url', { route: 'https://evil.example/phish' }],
    ['a missing route', { kind: 'reminders' }],
    ['an invoice without an id', { route: '/(app)/invoice/[id]' }],
    ['an invoice id with path traversal', { route: '/(app)/invoice/[id]', params: { id: '../settings' } }],
    ['an over-long invoice id', { route: '/(app)/invoice/[id]', params: { id: 'a'.repeat(65) } }],
    ['params on a static route', { route: '/(app)/subscriptions', params: { id: 'x' } }],
    ['non-object data', 'not-an-object'],
  ])('ignores %s', async (_label, data) => {
    mountHandler();
    await act(async () => {});

    tap(makeResponse(data));
    await act(async () => {});

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('ignores non-tap actions', async () => {
    mountHandler();
    await act(async () => {});

    tap(makeResponse({ route: '/(app)/notifications' }, { action: 'custom.action' }));
    await act(async () => {});

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles the same notification only once', async () => {
    mountHandler();
    await act(async () => {});
    const response = makeResponse({ route: '/(app)/notifications' }, { id: 'dup-1' });

    tap(response);
    tap(response);

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
  });

  it('handles the cold-start response and clears it', async () => {
    mockNotifications.getLastNotificationResponse.mockReturnValue(
      makeResponse({ route: '/(app)/invoice/[id]', params: { id: 'cold-1' } })
    );

    mountHandler();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/invoice/cold-1'));
    expect(mockNotifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('holds a cold-start tap until auth resolves, then navigates when signed in', async () => {
    const session = deferred<TestSession>();
    configureSupabase(() => session.promise);
    mockNotifications.getLastNotificationResponse.mockReturnValue(
      makeResponse({ route: '/(app)/subscriptions' })
    );

    mountHandler();
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      session.resolve(signedInSession);
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/subscriptions'));
  });

  it('drops a cold-start tap when auth resolves to signed out', async () => {
    const session = deferred<TestSession>();
    configureSupabase(() => session.promise);
    mockNotifications.getLastNotificationResponse.mockReturnValue(
      makeResponse({ route: '/(app)/subscriptions' })
    );

    mountHandler();
    await act(async () => {
      session.resolve(null);
    });
    await act(async () => {});

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not navigate for a tap while signed out', async () => {
    setAuth(null);
    mountHandler();
    await act(async () => {});

    tap(makeResponse({ route: '/(app)/notifications' }));
    await act(async () => {});

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('waits for the root navigator before navigating', async () => {
    mockNavigationKey = undefined;
    const view = mountHandler();
    await act(async () => {});
    tap(makeResponse({ route: '/(app)/notifications' }));
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();

    mockNavigationKey = 'root';
    view.rerender(
      <AuthProvider>
        <PushNavigationHandler />
      </AuthProvider>
    );

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/(app)/notifications'));
  });
});

describe('resolvePushPath', () => {
  it('maps allowlisted payloads to paths and rejects the rest', () => {
    expect(resolvePushPath({ route: '/(app)/notifications' })).toBe('/(app)/notifications');
    expect(resolvePushPath({ route: '/(app)/invoice/[id]', params: { id: 'ok-1' } })).toBe('/(app)/invoice/ok-1');
    expect(resolvePushPath({ route: '/(app)/invoice/[id]', params: { id: 'a/b' } })).toBeNull();
    expect(resolvePushPath(undefined)).toBeNull();
  });
});
