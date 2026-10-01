import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkTheme } from './theme';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = '@haseela/theme_preference';

export function isValidThemePreference(value: unknown): value is ColorSchemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export interface ThemeContextValue {
  theme: Theme;
  colorScheme: 'light' | 'dark';
  preference: ColorSchemePreference;
  isDark: boolean;
  setPreference: (preference: ColorSchemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialPreference?: ColorSchemePreference;
}

export function ThemeProvider({ children, initialPreference }: ThemeProviderProps) {
  const deviceColorScheme = useDeviceColorScheme();
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(
    initialPreference ?? 'system'
  );

  const userSelectedRef = useRef<boolean>(false);
  const writeSequenceRef = useRef<number>(0);
  const pendingWriteRef = useRef<Promise<void>>(Promise.resolve());

  const persistPreference = useCallback((val: ColorSchemePreference) => {
    writeSequenceRef.current += 1;
    const currentSeq = writeSequenceRef.current;
    pendingWriteRef.current = pendingWriteRef.current
      .catch(() => {})
      .then(async () => {
        if (currentSeq === writeSequenceRef.current) {
          await AsyncStorage.setItem(THEME_STORAGE_KEY, val);
        }
      })
      .catch((err) => {
        console.error('Failed to persist theme preference to AsyncStorage', err);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Respect explicit initialPreference overrides (used in existing tests)
    if (initialPreference !== undefined) {
      return;
    }

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!isMounted) return;
        // Avoid slow hydration overwriting newer user selection
        if (userSelectedRef.current) return;
        if (isValidThemePreference(stored)) {
          setPreferenceState(stored);
        }
      })
      .catch((err) => {
        console.error('Failed to read theme preference from AsyncStorage', err);
      });

    return () => {
      isMounted = false;
    };
  }, [initialPreference]);

  const resolvedScheme: 'light' | 'dark' = useMemo(() => {
    if (preference === 'system') {
      return deviceColorScheme === 'dark' ? 'dark' : 'light';
    }
    return preference;
  }, [preference, deviceColorScheme]);

  const theme = useMemo(() => {
    return resolvedScheme === 'dark' ? darkTheme : lightTheme;
  }, [resolvedScheme]);

  const setPreference = useCallback(
    (nextPref: ColorSchemePreference) => {
      userSelectedRef.current = true;
      setPreferenceState(nextPref);
      persistPreference(nextPref);
    },
    [persistPreference]
  );

  const toggleTheme = useCallback(() => {
    userSelectedRef.current = true;
    setPreferenceState((prev) => {
      const current = prev === 'system' ? (deviceColorScheme === 'dark' ? 'dark' : 'light') : prev;
      const nextPref = current === 'dark' ? 'light' : 'dark';
      persistPreference(nextPref);
      return nextPref;
    });
  }, [deviceColorScheme, persistPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colorScheme: resolvedScheme,
      preference,
      isDark: resolvedScheme === 'dark',
      setPreference,
      toggleTheme,
    }),
    [theme, resolvedScheme, preference, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
