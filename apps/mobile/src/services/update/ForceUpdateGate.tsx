import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { checkUpdateRequired } from './minVersion';
import { UpdateRequiredScreen } from './UpdateRequiredScreen';

/** Foreground re-checks are throttled so rapid app switching does not hammer /api/health. */
export const FOREGROUND_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Blocks the whole app behind an "update required" screen when the server's minMobileVersion is
 * above this build's version. Checks on start and when returning to the foreground (throttled).
 * Fails open: a network error or malformed response never blocks, and never un-blocks an
 * already-blocked build.
 */
export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const [updateRequired, setUpdateRequired] = useState(false);
  const lastCheckRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const runCheck = () => {
      lastCheckRef.current = Date.now();
      checkUpdateRequired().then((result) => {
        if (!isMountedRef.current || result === 'unknown') return;
        setUpdateRequired(result === 'update-required');
      });
    };

    runCheck();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheckRef.current >= FOREGROUND_CHECK_INTERVAL_MS) {
        runCheck();
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.remove();
    };
  }, []);

  if (updateRequired) return <UpdateRequiredScreen />;
  return <>{children}</>;
}
