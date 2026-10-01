import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import {
  clearQueryAndPersistedCache,
  ASYNC_STORAGE_PERSISTER_KEY,
  asyncStoragePersister,
} from '../queryClient';
import { useIsOnline } from '../useIsOnline';
import { onlineManager } from '@tanstack/react-query';

describe('Query Cache & Persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('clears in-memory query cache and persisted AsyncStorage cache on demand', async () => {
    const testQueryClient = new QueryClient();

    // Populate in-memory query cache
    testQueryClient.setQueryData(['financials'], { balance: 50000 });
    expect(testQueryClient.getQueryData(['financials'])).toEqual({ balance: 50000 });

    // Populate persisted cache in AsyncStorage
    await AsyncStorage.setItem(
      ASYNC_STORAGE_PERSISTER_KEY,
      JSON.stringify({ clientState: { queries: [{ queryKey: ['financials'], state: { data: { balance: 50000 } } }] } })
    );
    const persistedBefore = await AsyncStorage.getItem(ASYNC_STORAGE_PERSISTER_KEY);
    expect(persistedBefore).not.toBeNull();

    // Perform clear
    await clearQueryAndPersistedCache(testQueryClient);

    // Verify in-memory query cache is completely emptied
    expect(testQueryClient.getQueryData(['financials'])).toBeUndefined();
    expect(testQueryClient.getQueryCache().getAll().length).toBe(0);

    // Verify persisted offline storage is cleared
    const persistedAfter = await AsyncStorage.getItem(ASYNC_STORAGE_PERSISTER_KEY);
    expect(persistedAfter).toBeNull();
  });

  describe('useIsOnline hook', () => {
    it('returns network status and updates when onlineManager changes', () => {
      act(() => {
        onlineManager.setOnline(true);
      });

      const { result } = renderHook(() => useIsOnline());
      expect(result.current).toBe(true);

      act(() => {
        onlineManager.setOnline(false);
      });
      expect(result.current).toBe(false);

      act(() => {
        onlineManager.setOnline(true);
      });
      expect(result.current).toBe(true);
    });
  });
});
