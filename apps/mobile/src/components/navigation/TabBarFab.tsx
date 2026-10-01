import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, TrendingUp, TrendingDown, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface TabBarFabProps {
  testID?: string;
}

export function TabBarFab({ testID = 'tab-bar-fab' }: TabBarFabProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);

  const bottomInset = Math.max(insets.bottom, 6);
  // Center FAB positioned slightly raised above tab bar
  const fabBottom = bottomInset + 14;

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

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.fabContainer, { bottom: fabBottom }]}
      >
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={t('transactions.fab.action')}
          onPress={handleOpenSheet}
          style={({ pressed }) => [
            styles.fabButton,
            {
              backgroundColor: theme.colors.accent,
              shadowColor: '#000',
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Plus size={28} color={theme.colors.accentFg} strokeWidth={2.5} />
        </Pressable>
      </View>

      <Modal
        visible={sheetVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSheet}
        testID="fab-action-sheet-modal"
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseSheet}
          testID="fab-action-sheet-backdrop"
        >
          <Pressable
            style={[
              styles.sheetCard,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
                borderTopColor: theme.colors.border,
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
              <Pressable
                testID="action-sheet-add-income"
                accessibilityRole="button"
                accessibilityLabel={t('transactions.fab.addIncome')}
                onPress={handleAddIncome}
                style={({ pressed }) => [
                  styles.actionItem,
                  {
                    backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                    borderColor: theme.colors.border,
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
              </Pressable>

              <Pressable
                testID="action-sheet-add-expense"
                accessibilityRole="button"
                accessibilityLabel={t('transactions.fab.addExpense')}
                onPress={handleAddExpense}
                style={({ pressed }) => [
                  styles.actionItem,
                  {
                    backgroundColor: pressed ? theme.colors.surfaceHover : theme.colors.surface,
                    borderColor: theme.colors.border,
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
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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
    elevation: 6,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 36,
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
    minHeight: 56, // >= 44pt touch target
    padding: 12,
    borderRadius: 12,
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
