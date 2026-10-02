import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import {
  LOCALE_STORAGE_KEY,
  getStoredLocale,
  setStoredLocale,
  initLocale,
} from '../localeStorage';
import * as rtlModule from '../rtl';
import * as deviceLocaleModule from '../deviceLocale';

describe('i18n locale storage & startup direction sync', () => {
  const allowRTLSpy = jest.spyOn(I18nManager, 'allowRTL');
  const forceRTLSpy = jest.spyOn(I18nManager, 'forceRTL');

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    allowRTLSpy.mockRestore();
    forceRTLSpy.mockRestore();
  });

  it('persists and retrieves locale from AsyncStorage', async () => {
    expect(await getStoredLocale()).toBeNull();

    await setStoredLocale('ar');
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
    expect(await getStoredLocale()).toBe('ar');

    await setStoredLocale('en');
    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(await getStoredLocale()).toBe('en');
  });

  it('returns null when stored locale is invalid', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'invalid-lang');
    expect(await getStoredLocale()).toBeNull();
  });

  it('at startup, initLocale() loads stored Arabic locale and syncs I18nManager RTL', async () => {
    await setStoredLocale('ar');

    // Simulate I18nManager starting in LTR (isRTL = false)
    (I18nManager as any).isRTL = false;

    const resolvedLocale = await initLocale();
    expect(resolvedLocale).toBe('ar');

    // Must have forced RTL for Arabic
    expect(forceRTLSpy).toHaveBeenCalledWith(true);
    expect(allowRTLSpy).toHaveBeenCalledWith(true);
  });

  it('at startup, initLocale() loads stored English locale and syncs I18nManager LTR', async () => {
    await setStoredLocale('en');

    // Simulate I18nManager starting in RTL (isRTL = true)
    (I18nManager as any).isRTL = true;

    const resolvedLocale = await initLocale();
    expect(resolvedLocale).toBe('en');

    // Must have forced LTR for English
    expect(forceRTLSpy).toHaveBeenCalledWith(false);
    expect(allowRTLSpy).toHaveBeenCalledWith(false);
  });

  it('at startup, initLocale() falls back to device locale when no stored locale exists', async () => {
    jest.spyOn(deviceLocaleModule, 'getDeviceLocale').mockReturnValue('ar');
    (I18nManager as any).isRTL = false;

    const resolvedLocale = await initLocale();
    expect(resolvedLocale).toBe('ar');
    expect(forceRTLSpy).toHaveBeenCalledWith(true);

    (deviceLocaleModule.getDeviceLocale as jest.Mock).mockRestore();
  });
});
