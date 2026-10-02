import React from 'react';
import { render } from '@testing-library/react-native';
import { useSegments } from 'expo-router';
import { RootContent } from '../_layout';
import AuthLayout from '../(auth)/_layout';
import AppLayout, { checkNeedsOnboarding } from '../(app)/_layout';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as authModule from '../../auth';

jest.mock('../../auth', () => {
  const actual = jest.requireActual('../../auth');
  return {
    ...actual,
    useAuth: jest.fn(),
  };
});

const mockUsePreferences = jest.fn();
const mockUseOverview = jest.fn();

jest.mock('../../api', () => ({
  usePreferences: () => mockUsePreferences(),
  useOverview: () => mockUseOverview(),
}));

describe('Route Guard & Navigation Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePreferences.mockReturnValue({
      data: { onboardedAt: '2026-01-01T00:00:00.000Z' },
      isLoading: false,
    });
    mockUseOverview.mockReturnValue({
      data: { clients: [], subscriptions: [], transactions: [] },
      isLoading: false,
    });
  });

  describe('RootContent (Stack.Protected root guard)', () => {
    it('returns null while status === "loading" (keeps splash screen visible)', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'loading',
      });

      const { toJSON } = render(
        <ThemeProvider>
          <RootContent isLocaleReady={true} />
        </ThemeProvider>
      );

      expect(toJSON()).toBeNull();
    });

    it('returns null while isLocaleReady is false', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedOut',
      });

      const { toJSON } = render(
        <ThemeProvider>
          <RootContent isLocaleReady={false} />
        </ThemeProvider>
      );

      expect(toJSON()).toBeNull();
    });

    it('renders only (auth) screen when status === "signedOut"', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedOut',
      });

      const { getByTestId, queryByTestId } = render(
        <ThemeProvider>
          <RootContent isLocaleReady={true} />
        </ThemeProvider>
      );

      expect(getByTestId('stack-screen-(auth)')).toBeTruthy();
      expect(queryByTestId('stack-screen-(app)')).toBeNull();
    });

    it('renders only (app) screen when status === "signedIn"', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
      });

      const { getByTestId, queryByTestId } = render(
        <ThemeProvider>
          <RootContent isLocaleReady={true} />
        </ThemeProvider>
      );

      expect(getByTestId('stack-screen-(app)')).toBeTruthy();
      expect(queryByTestId('stack-screen-(auth)')).toBeNull();
    });
  });

  describe('AuthLayout (auth group guard)', () => {
    it('returns null while loading', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'loading',
      });

      const { toJSON } = render(
        <ThemeProvider>
          <AuthLayout />
        </ThemeProvider>
      );

      expect(toJSON()).toBeNull();
    });

    it('redirects to /(app) if user is already signedIn', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
      });

      const { getByTestId } = render(
        <ThemeProvider>
          <AuthLayout />
        </ThemeProvider>
      );

      const redirect = getByTestId('redirect-mock');
      expect(redirect).toBeTruthy();
      expect(redirect.props.href).toBe('/(app)');
    });

    it('renders stack navigator when signedOut', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedOut',
      });

      const { toJSON } = render(
        <ThemeProvider>
          <AuthLayout />
        </ThemeProvider>
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('AppLayout (app group guard & onboarding gate)', () => {
    it('returns null while auth status is loading', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'loading',
      });

      const { toJSON } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      expect(toJSON()).toBeNull();
    });

    it('redirects to /(auth)/login if user is signedOut', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedOut',
      });

      const { getByTestId } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      const redirect = getByTestId('redirect-mock');
      expect(redirect).toBeTruthy();
      expect(redirect.props.href).toBe('/(auth)/login');
    });

    it('renders centred ActivityIndicator while preferences or overview are loading', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
      });
      mockUsePreferences.mockReturnValue({ data: null, isLoading: true });

      const { getByTestId, getByLabelText } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      expect(getByTestId('gate-loading-container')).toBeTruthy();
      expect(getByLabelText('Loading…')).toBeTruthy();
    });

    it('falls through to tabs when preferences or overview fail (error or offline with no cache)', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
        user: { id: 'test-user-err' },
      });
      (useSegments as jest.Mock).mockReturnValue(['(app)', '(tabs)']);
      mockUsePreferences.mockReturnValue({ data: null, isLoading: false, isError: true });
      mockUseOverview.mockReturnValue({ data: null, isLoading: false, isError: true });

      const { queryByTestId, toJSON } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      expect(queryByTestId('redirect-mock')).toBeNull();
      expect(toJSON()).toBeTruthy();
    });

    it('onboarding gate: onboarded user renders app stack navigator', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
      });
      mockUsePreferences.mockReturnValue({
        data: { onboardedAt: '2026-01-01T00:00:00.000Z' },
        isLoading: false,
      });
      mockUseOverview.mockReturnValue({
        data: { clients: [], subscriptions: [], transactions: [] },
        isLoading: false,
      });

      const { toJSON } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      expect(toJSON()).toBeTruthy();
    });

    it('onboarding gate: new empty user redirects to /(app)/onboarding', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
      });
      (useSegments as jest.Mock).mockReturnValue(['(app)', '(tabs)']);
      mockUsePreferences.mockReturnValue({
        data: { onboardedAt: null },
        isLoading: false,
      });
      mockUseOverview.mockReturnValue({
        data: { clients: [], subscriptions: [], transactions: [] },
        isLoading: false,
      });

      const { getByTestId } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      const redirect = getByTestId('redirect-mock');
      expect(redirect).toBeTruthy();
      expect(redirect.props.href).toBe('/(app)/onboarding');
    });

    it('onboarding gate: existing user with data renders app stack without redirecting', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
      });
      (useSegments as jest.Mock).mockReturnValue(['(app)', '(tabs)']);
      mockUsePreferences.mockReturnValue({
        data: { onboardedAt: null },
        isLoading: false,
      });
      mockUseOverview.mockReturnValue({
        data: {
          clients: [{ id: 'c1', name: 'Existing Client' }],
          subscriptions: [],
          transactions: [],
        },
        isLoading: false,
      });

      const { toJSON } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      expect(toJSON()).toBeTruthy();
    });

    it('redirects already onboarded user back to tabs if they open /onboarding directly', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
        user: { id: 'test-user-already-onboarded' },
      });
      (useSegments as jest.Mock).mockReturnValue(['(app)', 'onboarding']);
      mockUsePreferences.mockReturnValue({
        data: { onboardedAt: '2026-01-01T00:00:00.000Z' },
        isLoading: false,
      });
      mockUseOverview.mockReturnValue({
        data: { clients: [], subscriptions: [], transactions: [] },
        isLoading: false,
      });

      const { getByTestId } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      const redirect = getByTestId('redirect-mock');
      expect(redirect).toBeTruthy();
      expect(redirect.props.href).toBe('/(app)/(tabs)');
    });

    it('regression: does not eject user mid-flow when overview updates with a client, and redirects to tabs on finish', () => {
      (authModule.useAuth as jest.Mock).mockReturnValue({
        status: 'signedIn',
        user: { id: 'test-user-mid-flow' },
      });
      (useSegments as jest.Mock).mockReturnValue(['(app)', 'onboarding']);

      // 1. Initial state: needs onboarding, rendered on /onboarding
      mockUsePreferences.mockReturnValue({
        data: { onboardedAt: null },
        isLoading: false,
      });
      mockUseOverview.mockReturnValue({
        data: { clients: [], subscriptions: [], transactions: [] },
        isLoading: false,
      });

      const { queryByTestId, rerender } = render(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      // Onboarding route: no redirect back to tabs while in onboarding
      expect(queryByTestId('redirect-mock')).toBeNull();

      // 2. User creates client mid-flow: overview updates to contain a client
      mockUseOverview.mockReturnValue({
        data: {
          clients: [{ id: 'c1', name: 'Acme Corp' }],
          subscriptions: [],
          transactions: [],
        },
        isLoading: false,
      });

      rerender(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      // Assert NO redirect to tabs happens mid-flow
      expect(queryByTestId('redirect-mock')).toBeNull();

      // 3. After finish: onboardedAt is set
      mockUsePreferences.mockReturnValue({
        data: { onboardedAt: '2026-03-01T12:00:00.000Z' },
        isLoading: false,
      });

      rerender(
        <ThemeProvider>
          <I18nProvider initialLocale="en">
            <AppLayout />
          </I18nProvider>
        </ThemeProvider>
      );

      // Assert that after finish (onboardedAt set) the user lands on the tabs
      const redirect = queryByTestId('redirect-mock');
      expect(redirect).toBeTruthy();
      expect(redirect?.props.href).toBe('/(app)/(tabs)');
    });
  });

  describe('checkNeedsOnboarding gate logic unit tests', () => {
    it('returns false when user is already onboarded (onboardedAt !== null)', () => {
      const prefs = { onboardedAt: '2026-02-15T12:00:00Z' };
      const overview = { clients: [], subscriptions: [], transactions: [] };
      expect(checkNeedsOnboarding(prefs, overview)).toBe(false);
    });

    it('returns true when user has onboardedAt === null and has no clients, subs, or txs', () => {
      const prefs = { onboardedAt: null };
      const overview = { clients: [], subscriptions: [], transactions: [] };
      expect(checkNeedsOnboarding(prefs, overview)).toBe(true);
    });

    it('returns false for existing user with clients even if onboardedAt is null', () => {
      const prefs = { onboardedAt: null };
      const overview = { clients: [{ id: '1' }], subscriptions: [], transactions: [] };
      expect(checkNeedsOnboarding(prefs, overview)).toBe(false);
    });

    it('returns false for existing user with subscriptions even if onboardedAt is null', () => {
      const prefs = { onboardedAt: null };
      const overview = { clients: [], subscriptions: [{ id: 's1' }], transactions: [] };
      expect(checkNeedsOnboarding(prefs, overview)).toBe(false);
    });

    it('returns false for existing user with transactions even if onboardedAt is null', () => {
      const prefs = { onboardedAt: null };
      const overview = { clients: [], subscriptions: [], transactions: [{ id: 't1' }] };
      expect(checkNeedsOnboarding(prefs, overview)).toBe(false);
    });
  });
});
