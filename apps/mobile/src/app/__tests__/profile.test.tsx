import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import ProfileScreen, { getInitials } from '../(app)/profile';
import MoreScreen from '../(app)/(tabs)/more';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../auth/AuthProvider';
import { getSessionEpoch } from '../../auth/authScope';
import { setSupabaseClientForTesting } from '../../auth/supabase';
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
});
