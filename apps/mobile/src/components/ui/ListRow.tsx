import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { triggerHaptic } from '../motion';
import { Chevron } from './Chevron';
import { IconTile, IconTileProps } from './IconTile';

const noop = () => {};

export interface ListGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Rounded surface that stacks ListRows with hairline dividers between them. */
export function ListGroup({ children, style, testID }: ListGroupProps) {
  const { theme } = useTheme();
  const rows = React.Children.toArray(children);

  return (
    <View
      testID={testID}
      style={[
        styles.group,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.xl,
        },
        theme.shadows.sm,
        style,
      ]}
    >
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 ? (
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          ) : null}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconTileProps['icon'];
  iconTone?: IconTileProps['tone'];
  /** Custom leading element (replaces the icon tile), e.g. an Avatar. */
  leading?: React.ReactNode;
  /** Custom trailing element (replaces the chevron), e.g. a Switch or value text. */
  trailing?: React.ReactNode;
  /** Renders a switch as the trailing control and exposes the row as a switch. Row press toggles it. */
  switchValue?: boolean;
  /** Show the forward chevron when pressable. Default true when onPress is set and no trailing. */
  showChevron?: boolean;
  onPress?: () => void;
  /** Destructive styling for the title. */
  danger?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'accent',
  leading,
  trailing,
  switchValue,
  showChevron,
  onPress,
  danger = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const { theme } = useTheme();
  const isSwitch = switchValue !== undefined;
  const chevronVisible = (showChevron ?? Boolean(onPress)) && !trailing && !isSwitch;

  const content = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} tone={danger ? 'negative' : iconTone} /> : null)}
      <View style={styles.text}>
        <Text
          style={[
            theme.typography.bodySemiBold,
            { color: danger ? theme.colors.negativeText : theme.colors.text },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[theme.typography.caption, styles.subtitle, { color: theme.colors.textSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {isSwitch ? (
        // Visual only: the whole row is the touch target, so the switch never takes touches.
        <View pointerEvents="none">
          <Switch
            value={switchValue}
            onValueChange={noop}
            trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={theme.colors.borderStrong}
          />
        </View>
      ) : null}
      {chevronVisible ? <Chevron size={18} color={theme.colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={isSwitch ? { disabled, checked: switchValue } : { disabled }}
      disabled={disabled}
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent', opacity: disabled ? 0.55 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginStart: 72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
});
