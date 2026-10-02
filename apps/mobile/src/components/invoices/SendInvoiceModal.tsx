import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView } from 'react-native';
import { Send, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { Button, TextField } from '../ui';

export interface SendInvoiceModalProps {
  visible: boolean;
  invoiceNumber: string;
  defaultTo?: string;
  isSending: boolean;
  error?: string | null;
  disabled?: boolean;
  onSend: (data: { to: string; message: string }) => void;
  onCancel: () => void;
  testID?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function SendInvoiceModal({
  visible,
  invoiceNumber,
  defaultTo = '',
  isSending,
  error,
  disabled = false,
  onSend,
  onCancel,
  testID = 'send-invoice-modal',
}: SendInvoiceModalProps) {
  const { theme } = useTheme();
  const { t } = useI18n();

  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    if (visible) {
      setTo(defaultTo);
      setMessage('');
      setEmailTouched(false);
    }
  }, [visible, defaultTo]);

  const emailValid = isValidEmail(to);
  const showEmailError = emailTouched && !emailValid && to.length > 0;

  const handleSend = () => {
    setEmailTouched(true);
    if (!emailValid || isSending) return;
    onSend({ to: to.trim(), message: message.trim() });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSending ? undefined : onCancel}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.accentTint }]}>
                <Send size={22} color={theme.colors.accent} />
              </View>
              <Text
                accessibilityRole="header"
                style={[theme.typography.h3, styles.title, { color: theme.colors.text }]}
              >
                {t('invoices.send.modalTitle', { number: invoiceNumber })}
              </Text>
            </View>

            {Boolean(error) && (
              <View
                testID="send-invoice-error-banner"
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: theme.colors.negativeTint,
                    borderColor: theme.colors.negative,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                <AlertCircle size={18} color={theme.colors.negative} />
                <Text
                  style={[
                    theme.typography.small,
                    styles.errorText,
                    { color: theme.colors.negativeText },
                  ]}
                >
                  {error}
                </Text>
              </View>
            )}

            <View style={styles.fields}>
              <TextField
                label={t('invoices.send.recipientEmail')}
                value={to}
                onChangeText={(text) => {
                  setTo(text);
                  setEmailTouched(true);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('invoices.send.emailPlaceholder')}
                error={showEmailError ? t('invoices.send.errorEmailHint') : undefined}
                editable={!isSending}
                testID="send-recipient-email-input"
              />

              <TextField
                label={t('invoices.send.messageLabel')}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
                placeholder={t('invoices.send.messageHint')}
                editable={!isSending}
                testID="send-message-input"
              />
            </View>

            <View style={styles.actions}>
              <Button
                variant="secondary"
                onPress={onCancel}
                disabled={isSending}
                testID="cancel-send-invoice-btn"
              >
                {t('invoices.send.cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleSend}
                loading={isSending}
                disabled={isSending || disabled || !emailValid}
                testID="confirm-send-invoice-btn"
              >
                {t('invoices.send.sendInvoice')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    lineHeight: 18,
  },
  fields: {
    gap: 12,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
});
