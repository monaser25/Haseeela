import { useSyncExternalStore } from 'react';

/**
 * One-shot message carried across the local sign-out that follows an account deletion, so the
 * login screen can explain why the user landed there.
 * - `deleted`: the server confirmed the deletion is complete.
 * - `pending`: deletion intent is recorded (or the outcome is unknown after the request was sent)
 *   and the backend finishes it in the background.
 *
 * Plain module state (like authScope) so the API client can set it without React.
 */
export type AccountDeletionNotice = 'deleted' | 'pending';

let currentNotice: AccountDeletionNotice | null = null;
const listeners = new Set<() => void>();

export function getAccountDeletionNotice(): AccountDeletionNotice | null {
  return currentNotice;
}

export function setAccountDeletionNotice(notice: AccountDeletionNotice | null): void {
  if (currentNotice === notice) return;
  currentNotice = notice;
  listeners.forEach((listener) => listener());
}

export function clearAccountDeletionNotice(): void {
  setAccountDeletionNotice(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccountDeletionNotice(): AccountDeletionNotice | null {
  return useSyncExternalStore(subscribe, getAccountDeletionNotice, getAccountDeletionNotice);
}
