import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { initLocale, LOCALE_INIT_TIMEOUT_MS, LOCALE_STORAGE_KEY } from '../localeStorage';

/**
 * Cold start must always produce a locale. Before the fix a stalled AsyncStorage read or a throwing
 * native direction call left the root waiting forever, i.e. the app stuck on the splash screen.
 */
describe('initLocale cold start never hangs', () => {
  const spies: jest.SpyInstance[] = [];

  beforeEach(async () => {
    await AsyncStorage.clear();
    (I18nManager as { isRTL: boolean }).isRTL = false;
  });

  afterEach(() => {
    spies.forEach((spy) => spy.mockRestore());
    spies.length = 0;
    jest.useRealTimers();
    (I18nManager as { isRTL: boolean }).isRTL = false;
  });

  it('stored Arabic + native LTR flag: resolves Arabic and aligns the runtime direction', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'ar');
    (I18nManager as { isRTL: boolean }).isRTL = false;

    await expect(initLocale()).resolves.toBe('ar');
    expect(I18nManager.isRTL).toBe(true);
  });

  it('stored English + stale native RTL flag: resolves English and clears the RTL direction', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    (I18nManager as { isRTL: boolean }).isRTL = true;

    await expect(initLocale()).resolves.toBe('en');
    expect(I18nManager.isRTL).toBe(false);
  });

  it('a stalled storage read resolves with the device locale after the bounded timeout', async () => {
    jest.useFakeTimers();
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));

    const result = initLocale();
    await jest.advanceTimersByTimeAsync(LOCALE_INIT_TIMEOUT_MS);

    await expect(result).resolves.toBe('en');
  });

  it('a rejecting storage read resolves with the device locale', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(initLocale()).resolves.toBe('en');
  });

  it('a native direction call that throws does not stop startup', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'ar');
    spies.push(
      jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {
        throw new Error('native module unavailable');
      })
    );

    await expect(initLocale()).resolves.toBe('ar');
  });
});
