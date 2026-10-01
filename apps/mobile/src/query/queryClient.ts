import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { clearInvoicePdfCache, invalidateActivePdfOperations } from '../services/pdf/invoicePdfService';
import { bumpSessionEpoch, getCurrentAuthUserId, getSessionEpoch } from '../auth/authScope';
import { getSupabaseClient } from '../auth/supabase';

export const ASYNC_STORAGE_PERSISTER_KEY = 'REACT_QUERY_OFFLINE_CACHE';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

/** Persisted cache key for one owner; a different owner can never read or clear it. */
export function persistedCacheKey(ownerId: string): string {
  return `${ASYNC_STORAGE_PERSISTER_KEY}:${ownerId}`;
}

// Owners whose persisted cache this process has touched, so sign-out can clear the right key
// even though the auth scope is already `null` by the time the clear runs.
const touchedOwners = new Set<string>();
const ownerPersisters = new Map<string, Persister>();

function getOwnerPersister(ownerId: string): Persister {
  let persister = ownerPersisters.get(ownerId);
  if (!persister) {
    persister = createAsyncStoragePersister({
      key: persistedCacheKey(ownerId),
      storage: {
        getItem: (key) => AsyncStorage.getItem(key),
        removeItem: (key) => AsyncStorage.removeItem(key),
        // A throttled write that fires after sign-out / user switch must not resurrect the cache
        setItem: async (key, value) => {
          if (getCurrentAuthUserId() !== ownerId) return;
          await AsyncStorage.setItem(key, value);
        },
      },
    });
    ownerPersisters.set(ownerId, persister);
  }
  return persister;
}

async function resolveRestoreOwner(): Promise<string | undefined> {
  const scope = getCurrentAuthUserId();
  if (scope === null) return undefined;
  if (typeof scope === 'string') return scope;
  // Auth scope not initialized yet (the query provider mounts first): use the authoritative SDK user
  try {
    const { data, error } = await getSupabaseClient().auth.getSession();
    return error ? undefined : data?.session?.user?.id || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Owner-namespaced persister. The owner is resolved per call, frozen before any await and
 * re-checked afterwards; a signed-out / uninitialized scope never reads or writes a cache.
 */
export const asyncStoragePersister: Persister = {
  persistClient: (persistedClient) => {
    const owner = getCurrentAuthUserId();
    if (typeof owner !== 'string') return;
    touchedOwners.add(owner);
    return getOwnerPersister(owner).persistClient(persistedClient);
  },
  restoreClient: async () => {
    const epoch = getSessionEpoch();
    const owner = await resolveRestoreOwner();
    if (!owner || epoch !== getSessionEpoch()) return undefined;
    touchedOwners.add(owner);
    const restored = await getOwnerPersister(owner).restoreClient();
    const scope = getCurrentAuthUserId();
    if (epoch !== getSessionEpoch() || (scope !== undefined && scope !== owner)) return undefined;
    return restored;
  },
  removeClient: async () => {
    const owner = getCurrentAuthUserId();
    if (typeof owner !== 'string') return;
    await getOwnerPersister(owner).removeClient();
  },
};

let onlineManagerConfigured = false;

/**
 * Wires TanStack Query's onlineManager to NetInfo for accurate online/offline detection in React Native.
 */
export function setupOnlineManager() {
  if (onlineManagerConfigured) return;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      setOnline(isOnline);
    });
  });

  onlineManagerConfigured = true;
}

// Auto-wire on import
setupOnlineManager();

let cacheClearSeq = 0;

/**
 * Clears both the in-memory query cache and the persisted AsyncStorage cache.
 * Must be called on sign-out and user account change so that one user's data
 * is never visible to another user. Persisted keys are per owner, so removing the
 * previous owner's key (even from a stale call) can never wipe a newer owner's cache.
 */
export async function clearQueryAndPersistedCache(client: QueryClient = queryClient): Promise<void> {
  const currentClearSeq = ++cacheClearSeq;
  const currentOwner = getCurrentAuthUserId();
  // Everything this process persisted except the currently signed-in owner (switch case)
  const ownersToClear = [...touchedOwners].filter((owner) => owner !== currentOwner);
  bumpSessionEpoch();
  invalidateActivePdfOperations();
  client.getMutationCache().clear();
  client.getQueryCache().clear();
  client.clear();

  for (const owner of ownersToClear) {
    touchedOwners.delete(owner);
    ownerPersisters.delete(owner);
  }
  await Promise.all(
    [ASYNC_STORAGE_PERSISTER_KEY, ...ownersToClear.map(persistedCacheKey)].map(async (key) => {
      try {
        // The un-namespaced legacy key may hold any previous user's data: always drop it
        await AsyncStorage.removeItem(key);
      } catch {
        // Best-effort
      }
    })
  );

  if (currentClearSeq === cacheClearSeq) {
    try {
      await clearInvoicePdfCache();
    } catch {
      // Best-effort
    }
  }
}
