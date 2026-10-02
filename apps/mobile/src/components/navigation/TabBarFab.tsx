import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, TrendingUp, TrendingDown, X } from 'lucide-react-native';
import { useTheme, gradientDirection } from '../../theme';
import { useI18n } from '../../i18n';
import { PressableScale, useReduceMotion } from '../motion';
import { Chevron } from '../ui/Chevron';
import { TAB_BAR_FAB_SIZE, tabBarFabBottom } from './tabBarMetrics';

export interface TabBarFabProps {
  testID?: string;
}

export function TabBarFab({ testID = 'tab-bar-fab' }: TabBarFabProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [sheetVisible, setSheetVisible] = useState(false);

  const handleOpenSheet = () => setSheetVisible(true);
  const handleCloseSheet = () => setSheetVisible(false);

  const handleAddIncome = () => {
    handleCloseSheet();
    router.push({ pathname: '/transaction/new', params: { type: 'INCOME' } } as any);
  };

  const handleAddExpense = () => {
    handleCloseSheet();
    router.push({ pathname: '/transaction/new', params: { type: 'EXPENSE' } } as any);
  };

  const sheetEntering = reduceMotion
    ? undefined
    : SlideInDown.springify()
        .damping(theme.motion.spring.gentle.damping)
        .stiffness(theme.motion.spring.gentle.stiffness * 1.6)
        .mass(theme.motion.spring.gentle.mass);

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.fabContainer, { bottom: tabBarFabBottom(insets.bottom) }]}
      >
        <PressableScale
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={t('transactions.fab.action')}
          onPress={handleOpenSheet}
          haptic="light"
          scaleTo={0.92}
          style={[
            styles.fabButton,
            {
              backgroundColor: theme.colors.accent,
              borderColor: theme.colors.surface,
            },
            theme.shadows.lg,
            { shadowColor: theme.colors.accent },
          ]}
        >
          <LinearGradient
            colors={theme.gradients.accent}
            start={gradientDirection.diagonal.start}
            end={gradientDirection.diagonal.end}
            style={[StyleSheet.absoluteFill, styles.fabGradient]}
          />
          <Plus size={28} color={theme.colors.accentFg} strokeWidth={2.5} />
        </PressableScale>
      </View>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseSheet}
        testID="fab-action-sheet-modal"
      >
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(theme.motion.duration.base)}
          style={styles.modalRoot}
        >
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: theme.colors.scrim }]}
            onPress={handleCloseSheet}
            testID="fab-action-sheet-backdrop"
          >
            <Animated.View entering={sheetEntering}>
              <Pressable
                style={[
                  styles.sheetCard,
                  {
                    backgroundColor: theme.colors.surface,
                    paddingBottom: Math.max(insets.bottom, 16) + 12,
                    borderColor: theme.colors.border,
                    borderTopLeftRadius: theme.radius.xxl,
                    borderTopRightRadius: theme.radius.xxl,
                  },
                ]}
                onPress={(e) => e.stopPropagation()}
                testID="fab-action-sheet"
              >
                <View style={styles.sheetHandleContainer}>
                  <View
                    style={[
                      styles.sheetHandle,
                      { backgroundColor: theme.colors.borderStrong },
                    ]}
                  />
                </View>

                <View style={styles.sheetHeader}>
                  <Text
                    style={[
                      theme.typography.h2,
                      { color: theme.colors.text },
                    ]}
                    accessibilityRole="header"
                  >
                    {t('transactions.fab.action')}
                  </Text>
                  <Pressable
                    onPress={handleCloseSheet}
                    accessibilityRole="button"
                    accessibilityLabel={t('transactions.fab.close')}
                    testID="action-sheet-cancel"
                    hitSlop={8}
                    style={[
                      styles.closeButton,
                      { backgroundColor: theme.colors.surfaceHover },
                    ]}
                  >
                    <X size={18} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.actionsList}>
                  <PressableScale
                    testID="action-sheet-add-income"
                    accessibilityRole="button"
                    accessibilityLabel={t('transactions.fab.addIncome')}
                    onPress={handleAddIncome}
                    haptic="selection"
                    scaleTo={theme.motion.press.scaleCard}
                    style={[
                      styles.actionItem,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.lg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.actionIconCircle,
                        { backgroundColor: theme.colors.positiveTint },
                      ]}
                    >
                      <TrendingUp size={22} color={theme.colors.positiveText} />
                    </View>
                    <View style={styles.actionTextCol}>
                      <Text
                        style={[
                          theme.typography.bodySemiBold,
                          { color: theme.colors.text },
                        ]}
                      >
                        {t('transactions.fab.addIncome')}
                      </Text>
                      <Text
                        style={[
                          theme.typography.small,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {t('transactions.badges.revenue')}
                      </Text>
                    </View>
                    <Chevron size={18} color={theme.colors.textMuted} />
                  </PressableScale>

                  <PressableScale
                    testID="action-sheet-add-expense"
                    accessibilityRole="button"
                    accessibilityLabel={t('transactions.fab.addExpense')}
                    onPress={handleAddExpense}
                    haptic="selection"
                    scaleTo={theme.motion.press.scaleCard}
                    style={[
                      styles.actionItem,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radius.lg,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.actionIconCircle,
                        { backgroundColor: theme.colors.negativeTint },
                      ]}
                    >
                      <TrendingDown size={22} color={theme.colors.negativeText} />
                    </View>
                    <View style={styles.actionTextCol}>
                      <Text
                        style={[
                          theme.typography.bodySemiBold,
                          { color: theme.colors.text },
                        ]}
                      >
                        {t('transactions.fab.addExpense')}
                      </Text>
                      <Text
                        style={[
                          theme.typography.small,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {t('transactions.badges.expense')}
                      </Text>
                    </View>
                    <Chevron size={18} color={theme.colors.textMuted} />
                  </PressableScale>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  fabButton: {
    width: TAB_BAR_FAB_SIZE,
    height: TAB_BAR_FAB_SIZE,
    borderRadius: TAB_BAR_FAB_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGradient: {
    borderRadius: TAB_BAR_FAB_SIZE / 2,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsList: {
    gap: 12,
    marginTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64, // >= 44pt touch target
    padding: 12,
    borderWidth: 1,
    gap: 14,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
});
