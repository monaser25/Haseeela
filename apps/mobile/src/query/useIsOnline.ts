import { useState, useEffect } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Hook returning whether the device currently has network connectivity.
 * Subscribes to TanStack Query's onlineManager.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => onlineManager.isOnline());

  useEffect(() => {
    return onlineManager.subscribe((online) => {
      setIsOnline(online);
    });
  }, []);

  return isOnline;
}
