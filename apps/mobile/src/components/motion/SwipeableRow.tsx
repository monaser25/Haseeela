import React, { useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  I18nManager,
  StyleProp,
  ViewStyle,
  Pressable,
  Alert,
} from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Trash2, Archive } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useReduceMotion } from './useReduceMotion';

export type SwipeActionType = 'archive' | 'delete' | 'custom';

export interface SwipeActionConfig {
  type: SwipeActionType;
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  backgroundColor?: string;
  textColor?: string;
  onPress: () => void;
  isDestructive?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmText?: string;
  cancelText?: string;
  testID?: string;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Primary swipe action revealed behind the card */
  action?: SwipeActionConfig;
  /** Multiple actions if needed */
  actions?: SwipeActionConfig[];
  /** Whether dragging past full swipe threshold triggers primary action automatically */
  enableFullSwipe?: boolean;
  /** Whether swipe gestures are enabled */
  enabled?: boolean;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** TestID */
  testID?: string;
}

/** Global coordinator: ensures only one row is open at a time and rows close on scroll */
type SwipeableInstance = {
  close: () => void;
};

let activeSwipeable: SwipeableInstance | null = null;

export function closeOpenSwipeables() {
  if (activeSwipeable) {
    try {
      activeSwipeable.close();
    } catch {
      // Ignored if already unmounted
    }
    activeSwipeable = null;
  }
}

export function registerOpenSwipeable(instance: SwipeableInstance) {
  if (activeSwipeable && activeSwipeable !== instance) {
    try {
      activeSwipeable.close();
    } catch {
      // Ignored
    }
  }
  activeSwipeable = instance;
}

export function unregisterOpenSwipeable(instance: SwipeableInstance) {
  if (activeSwipeable === instance) {
    activeSwipeable = null;
  }
}

const ACTION_WIDTH = 76;
const THRESHOLD = 36;
const FULL_SWIPE_THRESHOLD = 140;

interface ActionsContainerProps {
  actions: SwipeActionConfig[];
  translation: SharedValue<number>;
  onTrigger: (action: SwipeActionConfig) => void;
  isRTL: boolean;
  enableFullSwipe: boolean;
  isFullSwipeArmed: SharedValue<boolean>;
}

function ActionsContainer({
  actions,
  translation,
  onTrigger,
  isRTL,
  enableFullSwipe,
  isFullSwipeArmed,
}: ActionsContainerProps) {
  const { theme } = useTheme();
  const thresholdHapticFired = useSharedValue(false);
  const fullSwipeHapticFired = useSharedValue(false);

  useAnimatedReaction(
    () => Math.abs(translation.value),
    (currentDist, prevDist) => {
      if (prevDist === null) return;
      if (currentDist >= THRESHOLD && !thresholdHapticFired.value) {
        thresholdHapticFired.value = true;
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      } else if (currentDist < THRESHOLD && thresholdHapticFired.value) {
        thresholdHapticFired.value = false;
      }

      if (enableFullSwipe && currentDist >= FULL_SWIPE_THRESHOLD && !fullSwipeHapticFired.value) {
        fullSwipeHapticFired.value = true;
        isFullSwipeArmed.value = true;
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      } else if (enableFullSwipe && currentDist < FULL_SWIPE_THRESHOLD && fullSwipeHapticFired.value) {
        fullSwipeHapticFired.value = false;
        isFullSwipeArmed.value = false;
      }
    }
  );

  const orderedActions = isRTL ? actions : [...actions].reverse();

  return (
    <View style={styles.actionsContainer}>
      {orderedActions.map((act) => {
        const isDelete = act.type === 'delete';
        const isArchive = act.type === 'archive';
        const defaultBg = isDelete
          ? theme.colors.negative
          : isArchive
          ? theme.colors.warning
          : theme.colors.accent;
        const bgColor = act.backgroundColor ?? defaultBg;
        const DefaultIcon = isDelete ? Trash2 : isArchive ? Archive : Trash2;
        const Icon = act.icon ?? DefaultIcon;

        return (
          <Pressable
            key={act.type}
            testID={act.testID ?? `swipe-action-${act.type}`}
            accessibilityRole="button"
            accessibilityLabel={act.label}
            onPress={() => onTrigger(act)}
            style={[
              styles.actionButton,
              {
                backgroundColor: bgColor,
                borderRadius: theme.radius.lg,
              },
            ]}
          >
            <Icon size={20} color={act.textColor ?? '#FFFFFF'} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={[
                styles.actionLabel,
                { color: act.textColor ?? '#FFFFFF' },
              ]}
            >
              {act.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwipeableRow({
  children,
  action,
  actions,
  enableFullSwipe = true,
  enabled = true,
  style,
  testID,
}: SwipeableRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const reduceMotion = useReduceMotion();
  const isRTL = I18nManager.isRTL;
  const isFullSwipeArmed = useSharedValue(false);
  const fullSwipeTriggered = useRef(false);

  const actionsList = useMemo(() => {
    if (actions && actions.length > 0) return actions;
    if (action) return [action];
    return [];
  }, [action, actions]);

  const primaryAction = actionsList[0];

  const handleTriggerAction = useCallback((act: SwipeActionConfig) => {
    const execute = () => {
      swipeableRef.current?.close();
      act.onPress();
    };

    if (act.confirmTitle || act.confirmMessage || act.isDestructive) {
      Alert.alert(
        act.confirmTitle || act.label,
        act.confirmMessage || '',
        [
          {
            text: act.cancelText || 'Cancel',
            style: 'cancel',
            onPress: () => {
              swipeableRef.current?.close();
            },
          },
          {
            text: act.confirmText || act.label,
            style: act.isDestructive ? 'destructive' : 'default',
            onPress: execute,
          },
        ]
      );
    } else {
      execute();
    }
  }, []);

  const handleOpen = useCallback(() => {
    registerOpenSwipeable({
      close: () => swipeableRef.current?.close(),
    });
    if (enableFullSwipe && isFullSwipeArmed.value && !fullSwipeTriggered.current && primaryAction) {
      fullSwipeTriggered.current = true;
      handleTriggerAction(primaryAction);
    }
  }, [enableFullSwipe, isFullSwipeArmed, primaryAction, handleTriggerAction]);

  const handleClose = useCallback(() => {
    unregisterOpenSwipeable({
      close: () => swipeableRef.current?.close(),
    });
    fullSwipeTriggered.current = false;
    isFullSwipeArmed.value = false;
  }, [isFullSwipeArmed]);

  const renderActions = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => {
      if (actionsList.length === 0) return null;
      return (
        <ActionsContainer
          actions={actionsList}
          translation={translation}
          onTrigger={handleTriggerAction}
          isRTL={isRTL}
          enableFullSwipe={enableFullSwipe}
          isFullSwipeArmed={isFullSwipeArmed}
        />
      );
    },
    [actionsList, handleTriggerAction, isRTL, enableFullSwipe, isFullSwipeArmed]
  );

  if (actionsList.length === 0 || !enabled) {
    return <View style={style}>{children}</View>;
  }

  const accessibilityActions = actionsList.map((act) => ({
    name: act.type,
    label: act.label,
  }));

  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const match = actionsList.find((act) => act.type === event.nativeEvent.actionName);
    if (match) {
      handleTriggerAction(match);
    }
  };

  return (
    <View
      testID={testID}
      style={style}
      accessible={false}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <ReanimatedSwipeable
        ref={swipeableRef}
        enabled={enabled}
        friction={reduceMotion ? 1 : 1.2}
        overshootFriction={reduceMotion ? 8 : 4}
        overshootLeft={isRTL && enableFullSwipe}
        overshootRight={!isRTL && enableFullSwipe}
        leftThreshold={THRESHOLD}
        rightThreshold={THRESHOLD}
        renderLeftActions={isRTL ? renderActions : undefined}
        renderRightActions={!isRTL ? renderActions : undefined}
        onSwipeableOpen={handleOpen}
        onSwipeableClose={handleClose}
        containerStyle={styles.swipeContainer}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
  },
  actionsContainer: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  actionButton: {
    width: ACTION_WIDTH,
    height: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
