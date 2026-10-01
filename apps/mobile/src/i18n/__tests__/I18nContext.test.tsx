import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nProvider, useI18n } from '../I18nContext';
import { LOCALE_STORAGE_KEY } from '../localeStorage';

describe('I18nProvider persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('persists chosen locale when setLocale is called', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider initialLocale="en">{children}</I18nProvider>
    );

    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');

    await act(async () => {
      result.current.setLocale('ar');
    });

    expect(result.current.locale).toBe('ar');
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
  });

  it('persists toggled locale when toggleLocale is called', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider initialLocale="en">{children}</I18nProvider>
    );

    const { result } = renderHook(() => useI18n(), { wrapper });

    await act(async () => {
      result.current.toggleLocale();
    });

    expect(result.current.locale).toBe('ar');
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');

    await act(async () => {
      result.current.toggleLocale();
    });

    expect(result.current.locale).toBe('en');
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });
});
