import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticKind = 'light' | 'selection' | 'success' | 'warning';

/**
 * Fire-and-forget haptic tick. Never throws and never blocks: devices without a haptic engine
 * and web simply do nothing.
 */
export function triggerHaptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  try {
    let pending: Promise<void>;
    switch (kind) {
      case 'selection':
        pending = Haptics.selectionAsync();
        break;
      case 'success':
        pending = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        pending = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        pending = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    pending.catch(() => {});
  } catch {
    // Haptics are decoration; swallow synchronous failures too.
  }
}
