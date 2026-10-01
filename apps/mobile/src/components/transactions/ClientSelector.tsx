import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import type { Client } from '@haseela/shared';
import { Users, ChevronDown, Check, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';

export interface ClientSelectorProps {
  clients: Client[];
  selectedClientId?: string;
  onChange: (clientId?: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function ClientSelector({
  clients,
  selectedClientId,
  onChange,
  disabled = false,
  testID = 'client-selector',
}: ClientSelectorProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const displayText = selectedClient ? selectedClient.name : t('pending.form.selectClient');

  const handleSelect = (clientId?: string) => {
    onChange(clientId);
    setModalOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.captionUpper, styles.label, { color: theme.colors.textMuted }]}>
        {t('pending.form.clientLabel')}
      </Text>

      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${t('pending.form.clientLabel')}: ${displayText}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setModalOpen(true)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Users size={18} color={theme.colors.textSecondary} />
        <Text
          style={[
            theme.typography.body,
            styles.clientText,
            { color: selectedClient ? theme.colors.text : theme.colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <ChevronDown size={18} color={theme.colors.textMuted} />
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
        testID="client-selector-modal"
      >
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[theme.typography.h2, { color: theme.colors.text }]}
                accessibilityRole="header"
              >
                {t('pending.form.clientLabel')}
              </Text>
              <Pressable
                onPress={() => setModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('transactions.fab.close')}
                testID="client-selector-close"
                hitSlop={8}
                style={[
                  styles.closeBtn,
                  { backgroundColor: theme.colors.surfaceHover },
                ]}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            {/* None option */}
            <Pressable
              testID="client-option-none"
              accessibilityRole="button"
              accessibilityLabel={t('transactions.actions.clearSearch')}
              onPress={() => handleSelect(undefined)}
              style={({ pressed }) => [
                styles.clientRow,
                {
                  backgroundColor: !selectedClientId
                    ? theme.colors.surfaceHover
                    : pressed
                      ? theme.colors.surfaceHover
                      : theme.colors.surface,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                {t('pending.form.selectClient')}
              </Text>
              {!selectedClientId && <Check size={18} color={theme.colors.accent} />}
            </Pressable>

            <FlatList
              data={clients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedClientId;
                return (
                  <Pressable
                    testID={`client-option-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    onPress={() => handleSelect(item.id)}
                    style={({ pressed }) => [
                      styles.clientRow,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.surfaceHover
                          : pressed
                            ? theme.colors.surfaceHover
                            : theme.colors.surface,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.bodyMedium,
                        { color: theme.colors.text },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected && <Check size={18} color={theme.colors.accent} />}
                  </Pressable>
                );
              }}
              style={styles.list}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48, // >= 44pt touch target
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    gap: 10,
  },
  clientText: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginTop: 8,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48, // >= 44pt touch target
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
