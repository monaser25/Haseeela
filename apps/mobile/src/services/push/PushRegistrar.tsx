import { useEffect } from 'react';
import { useAuth } from '../../auth';
import { registerDeviceForPush } from './registerPush';

/**
 * Registers this device for push once a user is signed in. Mounted inside the authenticated app
 * layout (after the onboarding gate), so the OS permission prompt appears when the user reaches the
 * app itself rather than at launch or on top of the sign-in / onboarding screens.
 */
export function PushRegistrar(): null {
  const { status, user } = useAuth();
  const ownerId = user?.id;

  useEffect(() => {
    if (status !== 'signedIn' || !ownerId) return;
    void registerDeviceForPush();
  }, [status, ownerId]);

  return null;
}
