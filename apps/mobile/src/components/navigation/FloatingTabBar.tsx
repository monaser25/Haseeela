import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, I18nManager, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Home, Receipt, Users, Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { PressableScale, useReduceMotion } from '../motion';
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_MARGIN_X,
  tabBarBottomPadding,
  CENTER_SLOT,
  slotFor,
  calculateSlotLayout,
} from './tabBarMetrics';
import { useTabSwipe } from './TabSwipeContext';

type TabIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ICONS: Record<string, TabIcon> = {
  index: Home,
  transactions: Receipt,
  clients: Users,
  more: Menu,
};

interface TabRoute {
  key: string;
  name: string;
  params?: object;
}

/** Subset of react-navigation's BottomTabBarProps that the bar actually uses. */
export interface FloatingTabBarProps {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<
    string,
    { options: { title?: string; tabBarAccessibilityLabel?: string } }
  >;
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string, params?: object) => void;
  };
}

interface TabItemProps {
  name: string;
  label: string;
  accessibilityLabel: string;
  focused: boolean;
  onPress: () => void;
}

function TabItem({ name, label, accessibilityLabel, focused, onPress }: TabItemProps) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const Icon = ICONS[name] ?? Menu;
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lift.value = reduceMotion ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, theme.motion.spring.snappy);
  }, [focused, reduceMotion, lift, theme.motion.spring.snappy]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.value }, { scale: 1 + 0.08 * lift.value }],
  }));

  const color = focused ? theme.colors.accentText : theme.colors.textMuted;

  return (
    <PressableScale
      testID={`tab-button-${name}`}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      haptic="selection"
      scaleTo={0.92}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Floating pill tab bar. It sits in the layout flow (not absolutely positioned) so screen content
 * never hides behind it. An accent pill springs between the measured item layouts; slot 2 is left open for the FAB.
 */
export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const tabSwipe = useTabSwipe();
  const [barWidth, setBarWidth] = useState(0);
  const [itemLayouts, setItemLayouts] = useState<Record<number, { x: number; width: number }>>({});

  const slotCount = state.routes.length + 1; // 4 routes + 1 center FAB slot = 5 slots
  const activeSlot = slotFor(state.index);

  // Fallback layout when onLayout has not yet fired (e.g. initial render or tests)
  const getSlotLayout = useCallback(
    (slot: number) => {
      if (itemLayouts[slot]) {
        return itemLayouts[slot];
      }
      return calculateSlotLayout(slot, barWidth, slotCount, I18nManager.isRTL);
    },
    [itemLayouts, barWidth, slotCount]
  );

  const activeLayout = getSlotLayout(activeSlot);

  // Shared values tracking the pill position and width
  const pillX = useSharedValue(activeLayout.x);
  const pillWidth = useSharedValue(activeLayout.width);

  // Arrays of slot coordinates exposed to Reanimated worklets for continuous swipe tracking
  const slotXArray = useSharedValue<number[]>([0, 0, 0, 0, 0]);
  const slotWArray = useSharedValue<number[]>([0, 0, 0, 0, 0]);

  // Update worklet slot coordinates whenever layouts or barWidth update
  useEffect(() => {
    const xs: number[] = [];
    const ws: number[] = [];
    for (let s = 0; s < slotCount; s++) {
      const l = getSlotLayout(s);
      xs.push(l.x);
      ws.push(l.width);
    }
    slotXArray.value = xs;
    slotWArray.value = ws;
  }, [slotCount, getSlotLayout, slotXArray, slotWArray]);

  // Spring pill to active slot layout on index change or layout change (when not dragging)
  useEffect(() => {
    if (tabSwipe?.isSwiping.value) {
      return;
    }
    const layout = getSlotLayout(activeSlot);
    if (layout.width > 0) {
      pillX.value = reduceMotion ? layout.x : withSpring(layout.x, theme.motion.spring.snappy);
      pillWidth.value = reduceMotion ? layout.width : withSpring(layout.width, theme.motion.spring.snappy);
    }
  }, [activeSlot, getSlotLayout, reduceMotion, pillX, pillWidth, theme.motion.spring.snappy, tabSwipe]);

  const pillStyle = useAnimatedStyle(() => {
    if (tabSwipe && tabSwipe.isSwiping.value) {
      const progress = tabSwipe.swipeProgress.value;
      const target = tabSwipe.targetSlot.value;
      if (target >= 0 && target !== activeSlot) {
        const fromX = slotXArray.value[activeSlot] ?? pillX.value;
        const toX = slotXArray.value[target] ?? fromX;
        const fromW = slotWArray.value[activeSlot] ?? pillWidth.value;
        const toW = slotWArray.value[target] ?? fromW;
        const p = Math.abs(progress);
        return {
          transform: [{ translateX: fromX + p * (toX - fromX) }],
          width: fromW + p * (toW - fromW),
        };
      }
    }
    return {
      transform: [{ translateX: pillX.value }],
      width: pillWidth.value,
    };
  });

  const handleBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  const recordSlotLayout = useCallback((slot: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setItemLayouts((prev) => {
      const existing = prev[slot];
      if (existing && Math.abs(existing.x - x) < 0.5 && Math.abs(existing.width - width) < 0.5) {
        return prev;
      }
      return { ...prev, [slot]: { x, width } };
    });
  }, []);

  const effectivePillWidth = activeLayout.width > 0 ? activeLayout.width : barWidth > 0 ? barWidth / slotCount : 0;

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: theme.colors.bg, paddingBottom: tabBarBottomPadding(insets.bottom) },
      ]}
    >
      <View
        accessibilityRole="tablist"
        onLayout={handleBarLayout}
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.xxl,
          },
          theme.shadows.md,
        ]}
      >
        {barWidth > 0 || effectivePillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            testID="floating-tab-bar-pill"
            style={[
              styles.pill,
              {
                width: effectivePillWidth,
                backgroundColor: theme.colors.accentTint,
                borderRadius: theme.radius.xl,
              },
              pillStyle,
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const focused = state.index === index;
          const slot = slotFor(index);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <React.Fragment key={route.key}>
              {index === CENTER_SLOT ? (
                <View
                  style={styles.centerSlot}
                  onLayout={(e) => recordSlotLayout(CENTER_SLOT, e)}
                />
              ) : null}
              <View
                style={styles.slotWrapper}
                onLayout={(e) => recordSlotLayout(slot, e)}
              >
                <TabItem
                  name={route.name}
                  label={label}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                  focused={focused}
                  onPress={onPress}
                />
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: TAB_BAR_MARGIN_X,
    paddingTop: 6,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
  },
  slotWrapper: {
    flex: 1,
    height: '100%',
  },
  item: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 44,
  },
  centerSlot: {
    flex: 1,
    height: '100%',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
