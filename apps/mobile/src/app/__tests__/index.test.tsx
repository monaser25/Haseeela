import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '../(app)/(tabs)/index';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as apiModule from '../../api';
import * as onlineModule from '../../query/useIsOnline';

jest.mock('../../auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'sarah@example.com', user_metadata: { name: 'Sarah' } },
    status: 'signedIn',
    signOut: jest.fn(),
  }),
}));

const mockUseOverview = jest.fn();
const mockUsePreferences = jest.fn();

jest.mock('../../api', () => ({
  useOverview: () => mockUseOverview(),
  usePreferences: () => mockUsePreferences(),
}));

jest.mock('../../query/useIsOnline', () => ({
  useIsOnline: jest.fn(),
}));

function renderHomeScreen(initialLocale = 'en' as const) {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialPreference="light">
        <I18nProvider initialLocale={initialLocale}>
          <HomeScreen />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('HomeScreen Dashboard States', () => {
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(true);
    mockUsePreferences.mockReturnValue({
      data: { currency: 'USD', name: 'Sarah' },
      isLoading: false,
    });
  });

  it('renders loading skeleton state when data is loading without cached overview', () => {
    mockUseOverview.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId, queryByTestId } = renderHomeScreen();
    expect(getByTestId('home-loading-skeleton')).toBeTruthy();
    expect(queryByTestId('home-screen')).toBeNull();
  });

  it('renders error state with retry button when query fails', () => {
    mockUseOverview.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      refetch: mockRefetch,
    });

    const { getByTestId, getByText } = renderHomeScreen();
    expect(getByTestId('home-error-state')).toBeTruthy();
    expect(getByText('Network timeout')).toBeTruthy();

    const retryBtn = getByTestId('retry-button');
    fireEvent.press(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders empty state with clear action when user has zero data', () => {
    mockUseOverview.mockReturnValue({
      data: {
        clients: [],
        subscriptions: [],
        transactions: [],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId, getByText } = renderHomeScreen();
    expect(getByTestId('home-empty-state')).toBeTruthy();
    expect(getByTestId('empty-action-button')).toBeTruthy();
  });

  it('renders dashboard with correct formatted totals and stat cards announced as "label, value"', () => {
    const mockOverview = {
      clients: [
        { id: 'c1', name: 'Acme Corp', status: 'ACTIVE', revenue: 5000 },
      ],
      subscriptions: [
        {
          id: 's1',
          name: 'Figma',
          amount: 15,
          cycle: 'MONTHLY',
          status: 'ACTIVE',
          nextBillingDate: '2026-04-01T00:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'tx1',
          name: 'Acme Website',
          amount: 5000,
          type: 'INCOME',
          status: 'COMPLETED',
          date: '2026-03-10T12:00:00.000Z',
          categoryId: 'CLIENT',
        },
        {
          id: 'tx2',
          name: 'Server Hosting',
          amount: 200,
          type: 'EXPENSE',
          status: 'COMPLETED',
          date: '2026-03-09T12:00:00.000Z',
          categoryId: 'TOOLS',
        },
        {
          id: 'tx3',
          name: 'Milestone 2',
          amount: 1200,
          type: 'INCOME',
          status: 'PENDING',
          date: '2026-03-15T12:00:00.000Z',
          expectedDate: '2026-03-15T12:00:00.000Z',
          categoryId: 'CLIENT',
        },
      ],
    };

    mockUseOverview.mockReturnValue({
      data: mockOverview,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId } = renderHomeScreen();

    // Net profit = 5000 - 200 = 4800
    const netCard = getByTestId('stat-card-net-profit');
    expect(netCard.props.accessibilityLabel).toBe('Net profit, ⁦4,800.00 $⁩');
    expect(getByTestId('stat-value-net-profit').props.children).toContain('4,800');

    // Revenue = 5000
    const revCard = getByTestId('stat-card-revenue');
    expect(revCard.props.accessibilityLabel).toBe('Total revenue, ⁦5,000.00 $⁩');

    // Expenses = 200
    const expCard = getByTestId('stat-card-expenses');
    expect(expCard.props.accessibilityLabel).toBe('Total expenses, ⁦200.00 $⁩');

    // Pending = 1200
    const pendingCard = getByTestId('stat-card-pending');
    expect(pendingCard.props.accessibilityLabel).toBe('Pending payments, ⁦1,200.00 $⁩');

    // Upcoming subscriptions card rendered
    expect(getByTestId('active-subscriptions-card')).toBeTruthy();
    // Recent transactions card rendered
    expect(getByTestId('recent-transactions-card')).toBeTruthy();
  });

  it('renders overdue pending alert banner when overdue pending payments exist', () => {
    const mockOverview = {
      clients: [],
      subscriptions: [],
      transactions: [
        {
          id: 'tx-overdue',
          name: 'Late Invoice',
          amount: 800,
          type: 'INCOME',
          status: 'PENDING',
          date: '2025-01-01T00:00:00.000Z',
          expectedDate: '2025-01-01T00:00:00.000Z',
        },
      ],
    };

    mockUseOverview.mockReturnValue({
      data: mockOverview,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId } = renderHomeScreen();
    expect(getByTestId('overdue-pending-alert')).toBeTruthy();
  });

  it('renders offline banner when offline while displaying cached data', () => {
    (onlineModule.useIsOnline as jest.Mock).mockReturnValue(false);

    mockUseOverview.mockReturnValue({
      data: {
        clients: [],
        subscriptions: [],
        transactions: [
          {
            id: 'tx1',
            name: 'Cached Project',
            amount: 1000,
            type: 'INCOME',
            status: 'COMPLETED',
            date: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId } = renderHomeScreen();
    expect(getByTestId('offline-banner')).toBeTruthy();
    expect(getByTestId('home-screen')).toBeTruthy();
  });
});
