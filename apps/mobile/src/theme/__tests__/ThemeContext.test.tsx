import React, { useEffect } from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeProvider,
  useTheme,
  THEME_STORAGE_KEY,
  isValidThemePreference,
} from '../ThemeContext';

function TestConsumer({ onMount }: { onMount?: (themeCtx: ReturnType<typeof useTheme>) => void }) {
  const ctx = useTheme();

  useEffect(() => {
    onMount?.(ctx);
  }, [ctx, onMount]);

  return (
    <>
      <Text testID="current-preference">{ctx.preference}</Text>
      <Text testID="resolved-scheme">{ctx.colorScheme}</Text>
      <Pressable testID="btn-set-dark" onPress={() => ctx.setPreference('dark')} />
      <Pressable testID="btn-set-light" onPress={() => ctx.setPreference('light')} />
      <Pressable testID="btn-toggle" onPress={() => ctx.toggleTheme()} />
    </>
  );
}

describe('ThemeContext AsyncStorage persistence & concurrency safety', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('validates theme preference strings correctly', () => {
    expect(isValidThemePreference('light')).toBe(true);
    expect(isValidThemePreference('dark')).toBe(true);
    expect(isValidThemePreference('system')).toBe(true);
    expect(isValidThemePreference('neon')).toBe(false);
    expect(isValidThemePreference(null)).toBe(false);
    expect(isValidThemePreference(undefined)).toBe(false);
    expect(isValidThemePreference(123)).toBe(false);
  });

  it('hydrates valid stored preference on mount when no initialPreference is passed', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('current-preference').props.children).toBe('dark');
      expect(getByTestId('resolved-scheme').props.children).toBe('dark');
    });
  });

  it('falls back to system when AsyncStorage contains invalid preference value', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'invalid-cyberpunk-theme');

    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('current-preference').props.children).toBe('system');
    });
  });

  it('falls back safely to system when AsyncStorage read rejects', async () => {
    const spyConsole = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage failure'));

    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('current-preference').props.children).toBe('system');
    });
    spyConsole.mockRestore();
  });

  it('respects explicit initialPreference prop override and ignores AsyncStorage', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const { getByTestId } = render(
      <ThemeProvider initialPreference="light">
        <TestConsumer />
      </ThemeProvider>
    );

    expect(getByTestId('current-preference').props.children).toBe('light');
    expect(getByTestId('resolved-scheme').props.children).toBe('light');
  });

  it('in-flight hydration load does not overwrite newer user selection', async () => {
    let resolveGetItem: (val: string | null) => void = () => {};
    const pendingGetItem = new Promise<string | null>((resolve) => {
      resolveGetItem = resolve;
    });

    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(pendingGetItem as any);

    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    // User explicitly changes preference to 'light' while getItem is still pending
    fireEvent.press(getByTestId('btn-set-light'));

    expect(getByTestId('current-preference').props.children).toBe('light');

    // Now resolve the late getItem with 'dark'
    await act(async () => {
      resolveGetItem('dark');
    });

    // It must NOT overwrite the user's explicit choice with 'dark'
    expect(getByTestId('current-preference').props.children).toBe('light');
  });

  it('genuinely deferred old storage write does not overwrite newer choice or reorder persistence', async () => {
    let resolveFirstWrite: () => void = () => {};
    const firstWritePromise = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve;
    });

    let callCount = 0;
    const storageMap = new Map<string, string>();

    const spySet = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, val) => {
      callCount++;
      if (callCount === 1) {
        await firstWritePromise;
        // Even if old write eventually settles, it must not clobber newer choice
        storageMap.set(key, val);
        return;
      }
      storageMap.set(key, val);
    });

    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      return storageMap.get(key) ?? null;
    });

    const { getByTestId } = render(
      <ThemeProvider initialPreference="system">
        <TestConsumer />
      </ThemeProvider>
    );

    // First write 'dark' is dispatched and deferred
    fireEvent.press(getByTestId('btn-set-dark'));

    // Newer choice 'light' is dispatched while first write is still pending
    fireEvent.press(getByTestId('btn-set-light'));

    // Settle the old write
    await act(async () => {
      resolveFirstWrite();
    });

    // Final AsyncStorage value must be 'light'
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    spySet.mockRestore();
  });

  it('failed old write does not crash and allows subsequent writes to persist successfully', async () => {
    const spyConsole = jest.spyOn(console, 'error').mockImplementation(() => {});

    const storageMap = new Map<string, string>();

    const spySet = jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, val) => {
      if (val === 'dark') {
        throw new Error('Disk full');
      }
      storageMap.set(key, val);
    });

    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      return storageMap.get(key) ?? null;
    });

    const { getByTestId } = render(
      <ThemeProvider initialPreference="system">
        <TestConsumer />
      </ThemeProvider>
    );

    // First write fails
    fireEvent.press(getByTestId('btn-set-dark'));

    // Subsequent write succeeds
    fireEvent.press(getByTestId('btn-set-light'));

    await waitFor(async () => {
      expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    expect(getByTestId('current-preference').props.children).toBe('light');
    spySet.mockRestore();
    spyConsole.mockRestore();
  });
});
