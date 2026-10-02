import { I18nManager, Alert, Platform } from 'react-native';
import { Locale, dirFor } from '@haseela/shared';
import { translate } from './translate';

/**
 * RTL Layout Rule:
 * The layout direction is applied IN JS, so switching language never needs an app restart.
 * `I18nProvider` wraps the app in a view with `direction: 'rtl' | 'ltr'`; Yoga then mirrors
 * `flexDirection: 'row'`, `paddingStart`/`paddingEnd`, `marginStart`/`marginEnd` and row alignment
 * for the whole tree on its own.
 *
 * DO NOT manually invert layouts using reverse row directions, conditional
 * text alignment flips, or manual writingDirection overrides in components.
 * The only manual mirroring needed is for directional icons (e.g. back arrows / chevrons),
 * using `transform: [{ scaleX: -1 }]` conditional on `I18nManager.isRTL`, which this module keeps
 * equal to the runtime layout direction (see `syncI18nRTL`).
 *
 * The native `I18nManager` flag is still written, but only so the NEXT cold start already has the
 * matching native direction (native stack transitions, system dialogs). It is never required for
 * the current session to look right.
 */

export interface ApplyRTLResult {
  directionChanged: boolean;
  isRTL: boolean;
}

/**
 * React Native exposes `I18nManager.isRTL` as a constant captured at startup, so it never follows a
 * runtime direction change. Every reader (icons, the tab bar, tests) expects it to describe the
 * direction the UI is laid out in, so mirror the runtime direction onto it. A failure to assign
 * (frozen object on some platform) is harmless: the root `direction` style is what lays things out.
 */
function mirrorRuntimeDirection(isRTL: boolean): void {
  try {
    (I18nManager as { isRTL: boolean }).isRTL = isRTL;
  } catch {
    // Read-only constant: layout is unaffected, only legacy icon flips could be stale.
  }
}

/**
 * Syncs the layout direction with the selected locale: persists the native flag for the next cold
 * start and mirrors the runtime direction. Never throws, so a native hiccup cannot block startup.
 * Returns whether the direction changed compared to the previous runtime direction.
 */
export function syncI18nRTL(locale: Locale): ApplyRTLResult {
  const isRTL = dirFor(locale) === 'rtl';
  const directionChanged = I18nManager.isRTL !== isRTL;

  if (directionChanged) {
    try {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    } catch {
      // Persisting the native flag is best effort; the JS direction below is what the UI uses.
    }
  }
  mirrorRuntimeDirection(isRTL);

  return { directionChanged, isRTL };
}

/**
 * Optional restart prompt for direction changes. Not part of the normal language switch (the
 * direction is applied in JS); kept for flows that need native direction applied immediately.
 */
export function promptRestartForRTL(locale: Locale) {
  const title = translate(locale, 'rtl.restart.title');
  const message = translate(locale, 'rtl.restart.message');
  const confirm = translate(locale, 'rtl.restart.confirm');

  if (Platform.OS !== 'web') {
    Alert.alert(title, message, [{ text: confirm }]);
  }
}
