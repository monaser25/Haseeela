// Jest setup for mobile app
import '@testing-library/react-native';

// Pre-load react-native's lazily exported components. RN defines them as getters that transform and
// evaluate the component module on first access; on a cold Jest transform cache (always the case in
// CI) that costs 1-6s synchronously inside the first test that renders them, which blows RNTL's 1s
// findBy* deadline. Touching them here pays the cost during setup, outside any timed assertion.
// Plain property access only - no mocks.
const ReactNative = require('react-native');
void [
  ReactNative.ActivityIndicator,
  ReactNative.FlatList,
  ReactNative.KeyboardAvoidingView,
  ReactNative.Modal,
  ReactNative.Pressable,
  ReactNative.RefreshControl,
  ReactNative.ScrollView,
  ReactNative.SectionList,
  ReactNative.Switch,
  ReactNative.TextInput,
  ReactNative.TouchableOpacity,
];

process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mock-supabase.example.com';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

// Mock @react-native-community/datetimepicker
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => React.createElement(View, { testID: props.testID || 'date-time-picker', ...props });
});

// Mock expo-localization if needed in test environment
jest.mock('expo-localization', () => ({
  getLocales: () => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      textDirection: 'ltr',
      digitGroupingSeparator: ',',
      decimalSeparator: '.',
      measurementSystem: 'metric',
      currencyCode: 'USD',
      currencySymbol: '$',
      regionCode: 'US',
    },
  ],
  getCalendars: () => [
    {
      calendar: 'gregory',
      timeZone: 'UTC',
      uses24hourClock: false,
      firstWeekday: 1,
    },
  ],
  useLocales: () => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      textDirection: 'ltr',
      digitGroupingSeparator: ',',
      decimalSeparator: '.',
      measurementSystem: 'metric',
      currencyCode: 'USD',
      currencySymbol: '$',
      regionCode: 'US',
    },
  ],
}));

// Native push modules are not available under Jest. Defaults model a simulator with no permission;
// individual tests override behaviour on the mocked functions.
jest.mock('expo-device', () => ({
  __esModule: true,
  isDevice: false,
}));

jest.mock('expo-notifications', () => ({
  __esModule: true,
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied', granted: false, canAskAgain: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[mock-token]' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));

// Reanimated / worklets need native runtimes that do not exist under Jest. Use the libraries' own
// JS mocks; layout animations (entering/exiting) become no-ops and shared values are plain objects.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The library mock has no useReducedMotion. Default to "reduced motion on" so every component renders
// its final state synchronously (no entering animations, no count-up) - existing assertions stay
// deterministic. Motion tests override the mock to exercise the animated path.
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return { ...mock, useReducedMotion: jest.fn(() => true) };
});

// Haptics and gradients are native modules; stub them so components render under Jest.
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    LinearGradient: ({ children, colors, ...props }) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  };
});

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => true,
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    usePathname: jest.fn(() => '/'),
    useRootNavigationState: jest.fn(() => ({ key: 'root' })),
    useSegments: jest.fn(() => ['(app)', '(tabs)']),
    Link: ({ children }: any) => children,
    Redirect: ({ href }: any) => React.createElement(View, { testID: 'redirect-mock', href }),
    Stack: Object.assign(
      ({ children }: any) => React.createElement(View, null, children),
      {
        Screen: ({ name }: any) =>
          React.createElement(View, { testID: name ? `stack-screen-${name}` : 'stack-screen' }),
        Protected: ({ children, guard }: any) => (guard ? children : null),
      }
    ),
    Tabs: Object.assign(
      ({ children }: any) => React.createElement(View, { testID: 'tabs-navigator' }, children),
      {
        Screen: ({ name, options }: any) => {
          const title = typeof options?.title === 'function' ? options.title() : options?.title;
          const labelContent =
            typeof options?.tabBarLabel === 'function'
              ? options.tabBarLabel({ focused: false, color: '#000', children: '' })
              : (options?.tabBarLabel ?? title ?? name);

          return React.createElement(
            View,
            {
              testID: name ? `tab-screen-${name}` : 'tab-screen',
              accessibilityLabel: options?.tabBarAccessibilityLabel || title,
            },
            labelContent
          );
        },
      }
    ),
  };
});

// Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        return (props: any) =>
          React.createElement('View', {
            testID: `lucide-icon-${String(prop)}`,
            ...props,
          });
      },
    }
  );
});
