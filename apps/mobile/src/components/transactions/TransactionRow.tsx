import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { Transaction, CurrencyCode } from '@haseela/shared';
import {
  categoryLabel,
  daysOverdue,
  prefixCurrencySign,
} from '@haseela/shared';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Pencil,
  RotateCcw,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { parseCalendarDate } from '../../utils/calendarDate';
import { IconTile } from '../ui';
import { PressableScale, SwipeableRow } from '../motion';

export interface TransactionRowProps {
  transaction: Transaction;
  currency: CurrencyCode;
  onPress: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onCompletePending?: (transaction: Transaction) => void;
  onRevertPending?: (transaction: Transaction) => void;
  showPendingActions?: boolean;
  testID?: string;
}

function TransactionRowBase({
  transaction,
  currency,
  onPress,
  onDelete,
  onCompletePending,
  onRevertPending,
  showPendingActions = false,
  testID,
}: TransactionRowProps) {
  const { theme } = useTheme();
  const { t, formatCurrency, formatDate } = useI18n();

  const isIncome = transaction.type === 'INCOME';
  const isPending = transaction.status === 'PENDING';
  const canRevert = transaction.status === 'COMPLETED' && Boolean(transaction.expectedDate);
  const overdueDays = isPending ? daysOverdue(transaction) : 0;
  const isOverdue = overdueDays > 0;

  const title = transaction.name || transaction.notes || t('transactions.labels.unnamed');
  const catLabel = categoryLabel(transaction.categoryId, (k) => t(k));

  const formattedAmount = formatCurrency(transaction.amount, currency);
  const signedAmount = prefixCurrencySign(isIncome ? '+' : '-', formattedAmount);

  const txDate = transaction.expectedDate || transaction.date;
  const formattedDate = formatDate(parseCalendarDate(txDate), {
    month: 'short',
    day: 'numeric',
  });

  // Source label
  const sourceText =
    transaction.sourceType === 'client'
      ? t('transactions.source.client')
      : transaction.sourceType === 'subscription'
        ? t('transactions.source.subscription')
        : (transaction.sourceType as string) === 'invoice'
          ? t('transactions.source.invoice')
          : t('transactions.source.manual');

  // Status text for accessibility and badge
  let statusText = t('transactions.status.completed');
  if (isOverdue) {
    statusText = overdueDays === 1
      ? t('pending.badge.overdue', { days: 1 })
      : t('pending.badge.overduePlural', { days: overdueDays });
  } else if (isPending) {
    statusText = t('transactions.status.pending');
  }

  const accessibilityLabel = `${title}, ${signedAmount}, ${formattedDate}, ${statusText}`;

  const rowContent = (
    <PressableScale
      testID={testID ?? `transaction-row-${transaction.id}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => onPress(transaction)}
      scaleTo={theme.motion.press.scaleCard}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.xl,
        },
        theme.shadows.sm,
      ]}
    >
      <View style={styles.leftCol}>
        <IconTile
          icon={isIncome ? TrendingUp : TrendingDown}
          tone={isIncome ? 'positive' : 'negative'}
          size={44}
        />

        <View style={styles.contentCol}>
          <Text
            style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>

          <View style={styles.metaRow}>
            {/* Category tag */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[theme.typography.micro, { color: theme.colors.textSecondary }]}>
                {catLabel}
              </Text>
            </View>

            {/* Source badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[theme.typography.micro, { color: theme.colors.textMuted }]}>
                {sourceText}
              </Text>
            </View>

            {/* Status indicator (icon + text) */}
            {isOverdue ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.colors.negativeTint, borderColor: theme.colors.negative },
                ]}
              >
                <AlertCircle size={12} color={theme.colors.negativeText} />
                <Text style={[theme.typography.micro, { color: theme.colors.negativeText, fontWeight: '600' }]}>
                  {statusText}
                </Text>
              </View>
            ) : isPending ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warning },
                ]}
              >
                <Clock size={12} color={theme.colors.warningText} />
                <Text style={[theme.typography.micro, { color: theme.colors.warningText, fontWeight: '600' }]}>
                  {statusText}
                </Text>
              </View>
            ) : transaction.isEdited ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
                ]}
              >
                <Pencil size={11} color={theme.colors.textMuted} />
                <Text style={[theme.typography.micro, { color: theme.colors.textMuted }]}>
                  {t('transactions.badges.edited')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text
          style={[
            theme.typography.bodySemiBold,
            styles.amount,
            { color: isIncome ? theme.colors.positiveText : theme.colors.negativeText },
          ]}
        >
          {signedAmount}
        </Text>

        {showPendingActions && isPending && onCompletePending ? (
          <Pressable
            testID={`quick-complete-${transaction.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('transactions.pending.markAsReceived')}
            onPress={(e) => {
              e?.stopPropagation?.();
              onCompletePending(transaction);
            }}
            hitSlop={8}
            style={[
              styles.quickActionBtn,
              { backgroundColor: theme.colors.positiveTint, borderColor: theme.colors.positiveText },
            ]}
          >
            <CheckCircle2 size={13} color={theme.colors.positiveText} />
            <Text style={[theme.typography.micro, { color: theme.colors.positiveText, fontWeight: '600' }]}>
              {t('transactions.pending.markAsReceived')}
            </Text>
          </Pressable>
        ) : showPendingActions && canRevert && onRevertPending ? (
          <Pressable
            testID={`quick-revert-${transaction.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('transactions.pending.revert')}
            onPress={(e) => {
              e?.stopPropagation?.();
              onRevertPending(transaction);
            }}
            hitSlop={8}
            style={[
              styles.quickActionBtn,
              { backgroundColor: theme.colors.warningTint, borderColor: theme.colors.warningText },
            ]}
          >
            <RotateCcw size={13} color={theme.colors.warningText} />
            <Text style={[theme.typography.micro, { color: theme.colors.warningText, fontWeight: '600' }]}>
              {t('transactions.pending.revert')}
            </Text>
          </Pressable>
        ) : (
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {formattedDate}
          </Text>
        )}
      </View>
    </PressableScale>
  );

  return (
    <SwipeableRow
      enabled={Boolean(onDelete)}
      action={
        onDelete
          ? {
              type: 'delete',
              label: t('transactions.actions.delete'),
              isDestructive: true,
              confirmTitle: t('transactions.delete.title'),
              confirmMessage:
                transaction.sourceType === 'manual'
                  ? t('transactions.delete.descManual')
                  : t('transactions.delete.descAuto'),
              confirmText: t('transactions.delete.confirm'),
              cancelText: t('transactions.delete.cancel'),
              onPress: () => onDelete(transaction),
              testID: `transaction-delete-${transaction.id}`,
            }
          : undefined
      }
      style={styles.swipeWrapper}
    >
      {rowContent}
    </SwipeableRow>
  );
}

export const TransactionRow = React.memo(TransactionRowBase);

const styles = StyleSheet.create({
  swipeWrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68, // >= 44pt touch target
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
});
