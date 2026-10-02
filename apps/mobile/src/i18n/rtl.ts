import { I18nManager, Alert, Platform } from 'react-native';
import { Locale, dirFor } from '@haseela/shared';
import { translate } from './translate';

/**
 * RTL Layout Rule:
 * React Native & Yoga automatically mirror layout direction (`flexDirection: 'row'`,
 * `paddingStart`/`paddingEnd`, `marginStart`/`marginEnd`, and row alignments)
 * once `I18nManager.isRTL` is true after an app restart.
 *
 * DO NOT manually invert layouts using reverse row directions, conditional
 * text alignment flips, or manual writingDirection overrides in components.
 * The only manual mirroring needed is for directional icons (e.g. back arrows / chevrons),
 * using `transform: [{ scaleX: -1 }]` conditional on `I18nManager.isRTL` (actual layout direction).
 */

export interface ApplyRTLResult {
  directionChanged: boolean;
  isRTL: boolean;
}

/**
 * Syncs React Native's I18nManager with the selected locale's direction.
 * Returns whether the direction actually changed compared to current I18nManager state.
 */
export function syncI18nRTL(locale: Locale): ApplyRTLResult {
  const isRTL = dirFor(locale) === 'rtl';
  const directionChanged = I18nManager.isRTL !== isRTL;

  if (directionChanged) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }

  return { directionChanged, isRTL };
}

/**
 * Prompts the user to restart or reload the app if the layout direction has changed.
 */
export function promptRestartForRTL(locale: Locale) {
  const title = translate(locale, 'rtl.restart.title');
  const message = translate(locale, 'rtl.restart.message');
  const confirm = translate(locale, 'rtl.restart.confirm');

  if (Platform.OS !== 'web') {
    Alert.alert(title, message, [{ text: confirm }]);
  }
}
