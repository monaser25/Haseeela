import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { clearInvoicePdfCache, invalidateActivePdfOperations } from '../services/pdf/invoicePdfService';
import { bumpSessionEpoch } from '../auth/authScope';

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

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: ASYNC_STORAGE_PERSISTER_KEY,
});

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
 * is never visible to another user.
 */
export async function clearQueryAndPersistedCache(client: QueryClient = queryClient): Promise<void> {
  const currentClearSeq = ++cacheClearSeq;
  bumpSessionEpoch();
  invalidateActivePdfOperations();
  client.getMutationCache().clear();
  client.getQueryCache().clear();
  client.clear();

  try {
    await asyncStoragePersister.removeClient();
  } catch {
    // Best-effort
  }

  if (currentClearSeq === cacheClearSeq) {
    try {
      await clearInvoicePdfCache();
    } catch {
      // Best-effort
    }
  }
}
