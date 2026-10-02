import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import {
  clearQueryAndPersistedCache,
  ASYNC_STORAGE_PERSISTER_KEY,
  asyncStoragePersister,
  persistedCacheKey,
} from '../queryClient';
import { resetAuthScope, setAuthScope } from '../../auth/authScope';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { useIsOnline } from '../useIsOnline';
import { onlineManager } from '@tanstack/react-query';

const persistedClient = (balance: number): PersistedClient =>
  ({
    timestamp: Date.now(),
    buster: '',
    clientState: { mutations: [], queries: [
        { queryKey: ['financials'], queryHash: '["financials"]', dehydratedAt: 0, state: { data: { balance } } },
      ],
    },
  }) as unknown as PersistedClient;

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Query Cache & Persistence', () => {
  beforeEach(async () => {
    resetAuthScope();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears in-memory query cache and persisted AsyncStorage cache on demand', async () => {
    const testQueryClient = new QueryClient();

    // Populate in-memory query cache
    testQueryClient.setQueryData(['financials'], { balance: 50000 });
    expect(testQueryClient.getQueryData(['financials'])).toEqual({ balance: 50000 });

    // Populate persisted cache in AsyncStorage
    setAuthScope('user-A');
    await asyncStoragePersister.persistClient(persistedClient(50000));
    await flush();
    const persistedBefore = await AsyncStorage.getItem(persistedCacheKey('user-A'));
    expect(persistedBefore).not.toBeNull();

    // Sign-out: scope is already null when the clear runs
    setAuthScope(null);
    await clearQueryAndPersistedCache(testQueryClient);

    // Verify in-memory query cache is completely emptied
    expect(testQueryClient.getQueryData(['financials'])).toBeUndefined();
    expect(testQueryClient.getQueryCache().getAll().length).toBe(0);

    // Verify persisted offline storage is cleared
    const persistedAfter = await AsyncStorage.getItem(persistedCacheKey('user-A'));
    expect(persistedAfter).toBeNull();
  });

  it('user A -> sign out -> user B never sees A persisted cache', async () => {
    setAuthScope('user-A');
    await asyncStoragePersister.persistClient(persistedClient(111));
    await flush();
    expect(await AsyncStorage.getItem(ASYNC_STORAGE_PERSISTER_KEY)).toBeNull(); // no global key
    expect(await asyncStoragePersister.restoreClient()).toBeDefined();

    setAuthScope(null);
    await clearQueryAndPersistedCache(new QueryClient());
    expect(await AsyncStorage.getItem(persistedCacheKey('user-A'))).toBeNull();

    setAuthScope('user-B');
    expect(await asyncStoragePersister.restoreClient()).toBeUndefined();
  });

  it('user B cannot hydrate A cache even if A data is still on disk (no sign-out clear ran)', async () => {
    setAuthScope('user-A');
    await asyncStoragePersister.persistClient(persistedClient(111));
    await flush();

    setAuthScope('user-B');
    expect(await asyncStoragePersister.restoreClient()).toBeUndefined();
  });

  it('drops a persisted write that lands after sign-out so it cannot resurrect the cache', async () => {
    setAuthScope('late0-A');
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const pendingWrite = asyncStoragePersister.persistClient(persistedClient(1));
    setAuthScope(null);
    await pendingWrite;
    await flush();

    expect(await AsyncStorage.getItem(persistedCacheKey('late0-A'))).toBeNull();
    expect(setItem.mock.calls.filter(([key]) => key === persistedCacheKey('late0-A'))).toHaveLength(0);
  });

  it('a stale clear for owner A after owner B signed in does not wipe B cache', async () => {
    setAuthScope('late1-A');
    await asyncStoragePersister.persistClient(persistedClient(111));
    await flush();

    // A signs out; the removal of A's key hangs
    // removeItem is itself a jest.fn in the mock, so delete through multiRemove
    const realRemove = (key: string) => AsyncStorage.multiRemove([key]);
    let releaseA!: () => void;
    let gateOpen = false;
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementation((key: string) => {
      if (!gateOpen && key === persistedCacheKey('late1-A')) {
        return new Promise<void>((resolve) => {
          releaseA = () => {
            gateOpen = true;
            resolve(realRemove(key));
          };
        });
      }
      return realRemove(key);
    });
    setAuthScope(null);
    const staleClear = clearQueryAndPersistedCache(new QueryClient());

    // B signs in and persists while A's cleanup is still pending
    setAuthScope('late1-B');
    await asyncStoragePersister.persistClient(persistedClient(222));
    await flush();
    expect(await AsyncStorage.getItem(persistedCacheKey('late1-B'))).not.toBeNull();

    releaseA();
    await staleClear;

    expect(await AsyncStorage.getItem(persistedCacheKey('late1-A'))).toBeNull();
    expect(await AsyncStorage.getItem(persistedCacheKey('late1-B'))).not.toBeNull();
    expect((await asyncStoragePersister.restoreClient())?.clientState.queries[0].state.data).toEqual({
      balance: 222,
    });
  });

  it('a stale removeClient issued for owner A does not clear B after the owner switched', async () => {
    setAuthScope('late2-A');
    await asyncStoragePersister.persistClient(persistedClient(111));
    await flush();

    // removeItem is itself a jest.fn in the mock, so delete through multiRemove
    const realRemove = (key: string) => AsyncStorage.multiRemove([key]);
    let releaseA!: () => void;
    let gateOpen = false;
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementation((key: string) => {
      if (gateOpen) return realRemove(key);
      return new Promise<void>((resolve) => {
        releaseA = () => {
          gateOpen = true;
          resolve(realRemove(key));
        };
      });
    });
    const staleRemove = asyncStoragePersister.removeClient();

    setAuthScope('late2-B');
    await AsyncStorage.setItem(persistedCacheKey('late2-B'), JSON.stringify(persistedClient(222)));
    releaseA();
    await staleRemove;

    expect(await AsyncStorage.getItem(persistedCacheKey('late2-A'))).toBeNull();
    expect(await AsyncStorage.getItem(persistedCacheKey('late2-B'))).not.toBeNull();
  });

  it('does not read or write any cache while the auth scope is signed out', async () => {
    setAuthScope(null);
    await asyncStoragePersister.persistClient(persistedClient(5));
    await flush();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await asyncStoragePersister.restoreClient()).toBeUndefined();
  });

  it('removes the legacy global cache key on clear', async () => {
    await AsyncStorage.setItem(ASYNC_STORAGE_PERSISTER_KEY, JSON.stringify(persistedClient(9)));
    setAuthScope(null);
    await clearQueryAndPersistedCache(new QueryClient());
    expect(await AsyncStorage.getItem(ASYNC_STORAGE_PERSISTER_KEY)).toBeNull();
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
