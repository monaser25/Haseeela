import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { parsePushNavigation } from '@haseela/shared';
import { useAuth } from '../../auth';
import { configureForegroundNotifications } from './foregroundHandler';

/**
 * Turns a tapped push into an allowlisted in-app path, or null if the payload is not allowed.
 * The invoice id is validated by the shared parser, so it is safe to interpolate.
 */
export function resolvePushPath(data: unknown): string | null {
  const target = parsePushNavigation(data);
  if (!target) return null;
  return target.route === '/(app)/invoice/[id]' && target.params
    ? `/(app)/invoice/${target.params.id}`
    : target.route;
}

/**
 * Handles notification taps, both warm (listener) and cold start (last response).
 *
 * A tap is only acted on while signed in. If it arrives before auth has resolved it is held and then
 * either delivered (signed in) or dropped (signed out); a tap while signed out is dropped.
 * Mounted at the root so a cold-start tap is not missed; navigation waits for the root navigator.
 */
export function PushNavigationHandler(): null {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { status } = useAuth();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const handledRef = useRef<Set<string>>(new Set());

  const navigationReady = Boolean(navigationState?.key);

  useEffect(() => {
    configureForegroundNotifications();

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const requestId = response.notification?.request?.identifier;
      if (requestId) {
        if (handledRef.current.has(requestId)) return;
        handledRef.current.add(requestId);
      }
      Notifications.clearLastNotificationResponse();

      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const path = resolvePushPath(response.notification?.request?.content?.data);
      if (path) setPendingPath(path);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    handleResponse(Notifications.getLastNotificationResponse());

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pendingPath) return;
    if (status === 'signedOut') {
      setPendingPath(null);
      return;
    }
    if (status === 'signedIn' && navigationReady) {
      setPendingPath(null);
      router.push(pendingPath as never);
    }
  }, [pendingPath, status, navigationReady, router]);

  return null;
}
