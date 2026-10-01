// Jest setup for mobile app
import '@testing-library/react-native';

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
