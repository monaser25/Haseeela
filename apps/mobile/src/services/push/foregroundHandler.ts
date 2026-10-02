import * as Notifications from 'expo-notifications';

/**
 * Show pushes as a banner (and in the notification list) while the app is in the foreground.
 * Sound and badge stay off: the banner is informational and the app has no badge model.
 * Idempotent; the handler is process-global.
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
