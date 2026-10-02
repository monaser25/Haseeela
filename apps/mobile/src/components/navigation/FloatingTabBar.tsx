import React, { useEffect, useState } from 'react';
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
} from './tabBarMetrics';

type TabIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ICONS: Record<string, TabIcon> = {
  index: Home,
  transactions: Receipt,
  clients: Users,
  more: Menu,
};

/** The center slot is reserved for the floating action button. */
const CENTER_SLOT = 2;

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

/** Slot index of a route once the center FAB slot is accounted for. */
function slotFor(routeIndex: number): number {
  return routeIndex >= CENTER_SLOT ? routeIndex + 1 : routeIndex;
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
 * never hides behind it. An accent pill springs between the slots; slot 2 is left open for the FAB.
 */
export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [barWidth, setBarWidth] = useState(0);

  const slotCount = state.routes.length + 1;
  const slotWidth = barWidth / slotCount;
  const direction = I18nManager.isRTL ? -1 : 1;

  const pill = useSharedValue(slotFor(state.index));

  useEffect(() => {
    const target = slotFor(state.index);
    pill.value = reduceMotion ? target : withSpring(target, theme.motion.spring.snappy);
  }, [state.index, reduceMotion, pill, theme.motion.spring.snappy]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: direction * pill.value * slotWidth }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: theme.colors.bg, paddingBottom: tabBarBottomPadding(insets.bottom) },
      ]}
    >
      <View
        accessibilityRole="tablist"
        onLayout={handleLayout}
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
        {barWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                width: slotWidth,
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
              {index === CENTER_SLOT ? <View style={styles.centerSlot} /> : null}
              <TabItem
                name={route.name}
                label={label}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                focused={focused}
                onPress={onPress}
              />
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
    start: 0,
    top: 6,
    bottom: 6,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 44,
  },
  centerSlot: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
