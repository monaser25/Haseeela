import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Invoice, CurrencyCode } from '@haseela/shared';
import { effectiveInvoiceStatus } from '@haseela/shared';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Printer,
  Share2,
  CheckCircle2,
  Send,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../../theme';
import { useI18n } from '../../../i18n';
import { useAuth } from '../../../auth';
import {
  useInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useMarkInvoicePaid,
  useSendInvoice,
  useOverview,
  downloadInvoicePdf,
  previewAndPrintInvoicePdf,
  shareInvoicePdf,
} from '../../../api';
import { useIsOnline } from '../../../query';
import { Button, Banner, ScreenContainer } from '../../../components/ui';
import {
  InvoiceDetailHero,
  InvoiceDetailTimeline,
  InvoiceFormFields,
  validateInvoiceForm,
  type InvoiceFormData,
  type InvoiceFormErrors,
  DeleteInvoiceModal,
  MarkPaidInvoiceModal,
  SendInvoiceModal,
} from '../../../components/invoices';
import { parseCalendarDate, formatCalendarDate } from '../../../utils/calendarDate';
import { parseLocaleAmount } from '../../../components/transactions/parseAmount';

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceId = String(id || '');

  const { theme } = useTheme();
  const { t, formatCurrency } = useI18n();
  const { user } = useAuth();
  const isOnline = useIsOnline();

  const { data: invoice, isLoading, isError, refetch } = useInvoice(invoiceId);
  const { data: overview } = useOverview();
  const clients = useMemo(() => overview?.clients ?? [], [overview]);

  const [isEditing, setIsEditing] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfActionError, setPdfActionError] = useState<string | null>(null);

  // Modals state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Edit form state
  const [formData, setFormData] = useState<InvoiceFormData | null>(null);
  const [formErrors, setFormErrors] = useState<InvoiceFormErrors>({});
  const [editServerError, setEditServerError] = useState<string | null>(null);

  // Mutations
  const updateMutation = useUpdateInvoice();
  const deleteMutation = useDeleteInvoice();
  const markPaidMutation = useMarkInvoicePaid();
  const sendMutation = useSendInvoice();

  const isSaving = updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isMarking = markPaidMutation.isPending;
  const isSending = sendMutation.isPending;

  const isAnyPending = isSaving || isDeleting || isMarking || isSending || isPdfLoading;

  const effectiveStatus = invoice ? effectiveInvoiceStatus(invoice.status, invoice.dueDate) : 'DRAFT';
  const isPaid = effectiveStatus === 'PAID';

  // Watch for invoice becoming PAID or missing during background refetches while editing
  useEffect(() => {
    if (isEditing) {
      if (!invoice) {
        setIsEditing(false);
        setFormData(null);
      } else {
        const derived = effectiveInvoiceStatus(invoice.status, invoice.dueDate);
        if (derived === 'PAID') {
          setIsEditing(false);
          setFormData(null);
          setEditServerError(t('invoices.editor.cannotEditPaid'));
        }
      }
    }
  }, [invoice, isEditing, t]);

  // Enter edit mode: take fresh snapshot from invoice
  const handleStartEditing = useCallback(() => {
    if (!invoice || isPaid || !isOnline || isAnyPending) return;

    setFormData({
      number: invoice.number,
      clientId: invoice.clientId ?? null,
      currency: invoice.currency,
      issueDate: parseCalendarDate(invoice.issueDate),
      dueDate: parseCalendarDate(invoice.dueDate),
      taxRate: invoice.taxRate ? String(invoice.taxRate) : '',
      discount: invoice.discount ? String(invoice.discount) : '',
      notes: invoice.notes ?? '',
      terms: invoice.terms ?? '',
      lineItems: invoice.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: String(li.quantity),
        rate: String(li.rate),
      })),
    });
    setFormErrors({});
    setEditServerError(null);
    setIsEditing(true);
  }, [invoice, isPaid, isOnline, isAnyPending]);

  // Cancel edit mode: discard draft without saving
  const handleCancelEditing = useCallback(() => {
    if (isSaving) return;
    setIsEditing(false);
    setFormData(null);
    setFormErrors({});
    setEditServerError(null);
  }, [isSaving]);

  const handleSaveEdit = async () => {
    if (!formData || !invoice || !isOnline || isSaving) return;

    // Check if current invoice became PAID
    const currentStatus = effectiveInvoiceStatus(invoice.status, invoice.dueDate);
    if (currentStatus === 'PAID') {
      setIsEditing(false);
      setFormData(null);
      setEditServerError(t('invoices.editor.cannotEditPaid'));
      return;
    }

    const validation = validateInvoiceForm(formData, t);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});
    setEditServerError(null);

    const lineItemsPayload = formData.lineItems.map((li) => ({
      id: li.id,
      description: li.description.trim(),
      quantity: parseLocaleAmount(li.quantity),
      rate: parseLocaleAmount(li.rate),
    }));

    const taxRateNum = formData.taxRate ? parseLocaleAmount(formData.taxRate) : 0;
    const discountNum = formData.discount ? parseLocaleAmount(formData.discount) : 0;

    // Preserve loaded status — NEVER client writes SENT or PAID
    const payload = {
      number: formData.number?.trim() || invoice.number,
      clientId: formData.clientId || null,
      currency: formData.currency,
      issueDate: formatCalendarDate(formData.issueDate),
      dueDate: formatCalendarDate(formData.dueDate),
      status: invoice.status,
      taxRate: Number.isNaN(taxRateNum) ? 0 : taxRateNum,
      discount: Number.isNaN(discountNum) ? 0 : discountNum,
      notes: formData.notes?.trim() || null,
      terms: formData.terms?.trim() || null,
      lineItems: lineItemsPayload,
    };

    try {
      await updateMutation.mutateAsync({ id: invoice.id, data: payload });
      setIsEditing(false);
      setFormData(null);
    } catch {
      setEditServerError(t('invoices.editor.errorFailedSave'));
    }
  };

  const mapPdfError = (err: any): string => {
    if (err?.message === 'SHARING_NOT_AVAILABLE') {
      return t('invoices.pdf.errorNotAvailable');
    }
    return t('invoices.pdf.errorDownload');
  };

  // PDF Preview & Print
  const handlePrintPdf = async () => {
    if (!invoice || !isOnline || isAnyPending) return;
    setIsPdfLoading(true);
    setPdfActionError(null);
    try {
      const artifact = await downloadInvoicePdf(invoice.id, invoice.number);
      await previewAndPrintInvoicePdf(artifact);
    } catch (err: any) {
      setPdfActionError(mapPdfError(err));
    } finally {
      setIsPdfLoading(false);
    }
  };

  // PDF Share
  const handleSharePdf = async () => {
    if (!invoice || !isOnline || isAnyPending) return;
    setIsPdfLoading(true);
    setPdfActionError(null);
    try {
      const artifact = await downloadInvoicePdf(invoice.id, invoice.number);
      await shareInvoicePdf(artifact);
    } catch (err: any) {
      setPdfActionError(mapPdfError(err));
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Open modals with error reset
  const handleOpenMarkPaidModal = () => {
    if (!isOnline || isAnyPending) return;
    setMarkPaidError(null);
    setShowMarkPaidModal(true);
  };

  const handleOpenDeleteModal = () => {
    if (!isOnline || isAnyPending) return;
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleOpenSendModal = () => {
    if (!isOnline || isAnyPending) return;
    setSendError(null);
    setShowSendModal(true);
  };

  // Confirm Mark as Paid
  const handleConfirmMarkPaid = async () => {
    if (!invoice || !isOnline || isAnyPending) return;
    setMarkPaidError(null);
    try {
      await markPaidMutation.mutateAsync(invoice.id);
      setShowMarkPaidModal(false);
    } catch (err: any) {
      setMarkPaidError(t('invoices.toast.failedMarkPaid'));
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!invoice || !isOnline || isAnyPending) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(invoice.id);
      setShowDeleteModal(false);
      router.back();
    } catch (err: any) {
      setDeleteError(t('invoices.toast.failedDelete'));
    }
  };

  // Send Invoice
  const handleConfirmSend = async ({ to, message }: { to: string; message: string }) => {
    if (!invoice || !isOnline || isAnyPending) return;
    setSendError(null);
    try {
      await sendMutation.mutateAsync({
        id: invoice.id,
        to,
        message: message || undefined,
      });
      setShowSendModal(false);
    } catch (err: any) {
      if (err?.code === 'smtp_not_configured' || err?.status === 503) {
        setSendError(t('invoices.send.unavailable'));
      } else {
        setSendError(t('invoices.send.errorSend'));
      }
    }
  };

  // 1. Cold offline: no cached invoice and device is offline
  if (!isOnline && !invoice) {
    return (
      <ScreenContainer testID="invoice-detail-offline-screen" edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={theme.colors.warning} />
          <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 16 }]}>
            {t('offline.body')}
          </Text>
          <Button
            variant="primary"
            onPress={() => refetch()}
            style={styles.backButton}
            testID="invoice-offline-retry-btn"
          >
            {t('offline.action.retry')}
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.backButton}
            testID="invoice-offline-back-btn"
          >
            {t('invoices.back')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // 2. Cold loading: loading initial data and no cached invoice
  if (isLoading && !invoice) {
    return (
      <ScreenContainer testID="invoice-detail-loading-screen" edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[theme.typography.body, { color: theme.colors.textMuted, marginTop: 12 }]}>
            {t('invoices.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // 3. Initial load error or true Not Found (no cached invoice)
  if (!invoice) {
    return (
      <ScreenContainer testID="invoice-detail-not-found-screen" edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={theme.colors.negative} />
          <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 16 }]}>
            {isError ? t('invoices.error.loadTitle') : t('invoices.notFound')}
          </Text>
          {isError && (
            <Button
              variant="primary"
              onPress={() => refetch()}
              style={styles.backButton}
              testID="invoice-error-retry-btn"
            >
              {t('invoices.retry')}
            </Button>
          )}
          <Button
            variant="secondary"
            onPress={() => router.back()}
            style={styles.backButton}
            testID="invoice-not-found-back-btn"
          >
            {t('invoices.back')}
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="invoice-detail-screen" edges={['top', 'left', 'right', 'bottom']} scrollable={false} padded={false}>
      {/* Top Header */}
      <View style={styles.navBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('invoices.back')}
          onPress={() => (isEditing ? handleCancelEditing() : router.back())}
          disabled={isAnyPending}
          hitSlop={8}
          style={styles.iconButton}
          testID="invoice-detail-back-btn"
        >
          {isEditing ? <X size={22} color={theme.colors.text} /> : <ArrowLeft size={22} color={theme.colors.text} />}
        </Pressable>

        <Text
          accessibilityRole="header"
          style={[theme.typography.h2, styles.navTitle, { color: theme.colors.text }]}
          numberOfLines={1}
          testID="invoice-detail-header-title"
        >
          {isEditing && !isPaid
            ? t('invoices.editor.editTitle', { number: invoice.number })
            : `#${invoice.number}`}
        </Text>

        <View style={styles.navActions}>
          {!isEditing || isPaid ? (
            <>
              {!isPaid && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('invoices.actions.edit')}
                  onPress={handleStartEditing}
                  disabled={!isOnline || isAnyPending}
                  hitSlop={8}
                  style={[styles.iconButton, (!isOnline || isAnyPending) && { opacity: 0.5 }]}
                  testID="invoice-edit-btn"
                >
                  <Edit2 size={20} color={!isOnline || isAnyPending ? theme.colors.textMuted : theme.colors.text} />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('invoices.actions.delete')}
                onPress={handleOpenDeleteModal}
                disabled={!isOnline || isAnyPending}
                hitSlop={8}
                style={[styles.iconButton, (!isOnline || isAnyPending) && { opacity: 0.5 }]}
                testID="invoice-delete-btn"
              >
                <Trash2 size={20} color={!isOnline || isAnyPending ? theme.colors.textMuted : theme.colors.negative} />
              </Pressable>
            </>
          ) : (
            <Button
              variant="primary"
              onPress={handleSaveEdit}
              loading={isSaving}
              disabled={isSaving || !isOnline}
              testID="invoice-save-edit-btn"
            >
              {t('invoices.editor.toastSaved')}
            </Button>
          )}
        </View>
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="warning"
            message={t('invoices.offline.readOnly')}
            testID="invoice-detail-offline-banner"
          />
        </View>
      )}

      {/* Stale Data Banner with Retry when background refetch fails */}
      {isError && (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="error"
            message={t('invoices.staleDataBanner')}
            testID="invoice-detail-stale-banner"
          >
            <Button
              variant="secondary"
              onPress={() => refetch()}
              style={{ marginTop: 8 }}
              testID="invoice-detail-stale-retry-btn"
            >
              {t('invoices.retry')}
            </Button>
          </Banner>
        </View>
      )}

      {/* PDF Action Error Banner */}
      {Boolean(pdfActionError) && (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="error"
            message={pdfActionError!}
            testID="invoice-pdf-error-banner"
          />
        </View>
      )}

      {/* Edit Server Error Banner */}
      {Boolean(editServerError) && (
        <View style={styles.bannerWrapper}>
          <Banner
            tone="error"
            message={editServerError!}
            testID="invoice-edit-server-error-banner"
          />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isEditing && formData && !isPaid ? (
            <InvoiceFormFields
              data={formData}
              errors={formErrors}
              clients={clients}
              disabled={isSaving || !isOnline}
              onChange={(updates) => setFormData((prev) => prev ? { ...prev, ...updates } : null)}
              onLineItemChange={(index, updates) => {
                setFormData((prev) => {
                  if (!prev) return null;
                  const next = [...prev.lineItems];
                  next[index] = { ...next[index], ...updates };
                  return { ...prev, lineItems: next };
                });
              }}
              onAddLineItem={() => {
                setFormData((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    lineItems: [...prev.lineItems, { description: '', quantity: '1', rate: '' }],
                  };
                });
              }}
              onRemoveLineItem={(index) => {
                setFormData((prev) => {
                  if (!prev || prev.lineItems.length <= 1) return prev;
                  return {
                    ...prev,
                    lineItems: prev.lineItems.filter((_, i) => i !== index),
                  };
                });
              }}
              testID="invoice-edit-form-fields"
            />
          ) : (
            <>
              {/* Detail Hero Card */}
              <InvoiceDetailHero invoice={invoice} testID="invoice-detail-hero-card" />

              {/* Action Buttons: PDF Preview/Print, Share, Mark Paid, Send */}
              <View style={styles.actionsGrid}>
                <Button
                  variant="secondary"
                  icon={<Printer size={18} color={theme.colors.text} />}
                  onPress={handlePrintPdf}
                  loading={isPdfLoading}
                  disabled={isAnyPending || !isOnline}
                  style={styles.actionGridBtn}
                  testID="invoice-print-pdf-btn"
                >
                  {t('invoices.pdf.preview')}
                </Button>

                <Button
                  variant="secondary"
                  icon={<Share2 size={18} color={theme.colors.text} />}
                  onPress={handleSharePdf}
                  loading={isPdfLoading}
                  disabled={isAnyPending || !isOnline}
                  style={styles.actionGridBtn}
                  testID="invoice-share-pdf-btn"
                >
                  {t('invoices.pdf.share')}
                </Button>
              </View>

              <View style={styles.actionsRow}>
                {!isPaid && (
                  <Button
                    variant="primary"
                    icon={<CheckCircle2 size={18} color={theme.colors.surface} />}
                    onPress={handleOpenMarkPaidModal}
                    disabled={isAnyPending || !isOnline}
                    style={styles.actionPrimaryBtn}
                    testID="invoice-mark-paid-action-btn"
                  >
                    {t('invoices.actions.markPaid')}
                  </Button>
                )}

                {!isPaid && (
                  <Button
                    variant="secondary"
                    icon={<Send size={18} color={theme.colors.accent} />}
                    onPress={handleOpenSendModal}
                    disabled={isAnyPending || !isOnline}
                    style={styles.actionPrimaryBtn}
                    testID="invoice-send-action-btn"
                  >
                    {effectiveStatus === 'SENT' ? t('invoices.actions.resend') : t('invoices.actions.send')}
                  </Button>
                )}
              </View>

              {/* Line Items Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}
                testID="invoice-line-items-card"
              >
                <Text
                  style={[
                    theme.typography.captionUpper,
                    styles.cardHeaderTitle,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {t('invoices.editor.lineItemsLabel')}
                </Text>

                {invoice.lineItems.map((item, idx) => {
                  const qty = item.quantity;
                  const rate = item.rate;
                  const lineTotal = item.amount ?? qty * rate;

                  return (
                    <View
                      key={item.id || idx}
                      style={[
                        styles.lineItemDetailRow,
                        idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
                      ]}
                      testID={`invoice-detail-item-${idx}`}
                    >
                      <View style={styles.lineItemDetailText}>
                        <Text style={[theme.typography.bodySemiBold, { color: theme.colors.text }]}>
                          {item.description}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                          {`${qty} × ${formatCurrency(rate, invoice.currency)}`}
                        </Text>
                      </View>
                      <Text style={[theme.typography.bodySemiBold, styles.tabular, { color: theme.colors.text }]}>
                        {formatCurrency(lineTotal, invoice.currency)}
                      </Text>
                    </View>
                  );
                })}

                <View style={[styles.totalsBreakdown, { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                  <View style={styles.breakdownRow}>
                    <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                      {t('invoices.doc.subtotal')}
                    </Text>
                    <Text style={[theme.typography.bodySemiBold, styles.tabular, { color: theme.colors.text }]}>
                      {formatCurrency(invoice.subtotal, invoice.currency)}
                    </Text>
                  </View>

                  {invoice.discount > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                        {t('invoices.doc.discount')}
                      </Text>
                      <Text style={[theme.typography.bodySemiBold, styles.tabular, { color: theme.colors.textSecondary }]}>
                        -{formatCurrency(invoice.discount, invoice.currency)}
                      </Text>
                    </View>
                  )}

                  {invoice.taxAmount > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                        {t('invoices.doc.tax', { rate: String(invoice.taxRate) })}
                      </Text>
                      <Text style={[theme.typography.bodySemiBold, styles.tabular, { color: theme.colors.text }]}>
                        {formatCurrency(invoice.taxAmount, invoice.currency)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.breakdownDivider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.breakdownRow}>
                    <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
                      {t('invoices.doc.total')}
                    </Text>
                    <Text
                      style={[theme.typography.h2, styles.tabular, { color: theme.colors.text }]}
                      testID="invoice-detail-total-amount"
                    >
                      {formatCurrency(invoice.total, invoice.currency)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Notes & Terms Card */}
              {(Boolean(invoice.notes) || Boolean(invoice.terms)) && (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.lg,
                    },
                  ]}
                  testID="invoice-notes-terms-card"
                >
                  {Boolean(invoice.notes) && (
                    <View style={styles.notesBlock}>
                      <Text style={[theme.typography.captionUpper, { color: theme.colors.textMuted, marginBottom: 4 }]}>
                        {t('invoices.editor.notesLabel')}
                      </Text>
                      <Text style={[theme.typography.body, { color: theme.colors.text }]}>
                        {invoice.notes}
                      </Text>
                    </View>
                  )}

                  {Boolean(invoice.terms) && (
                    <View style={styles.notesBlock}>
                      <Text style={[theme.typography.captionUpper, { color: theme.colors.textMuted, marginBottom: 4 }]}>
                        {t('invoices.editor.termsLabel')}
                      </Text>
                      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                        {invoice.terms}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Real Timeline Card */}
              <InvoiceDetailTimeline invoice={invoice} testID="invoice-detail-timeline-card" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <DeleteInvoiceModal
        visible={showDeleteModal}
        invoiceNumber={invoice.number}
        isDeleting={isDeleting}
        error={deleteError}
        disabled={!isOnline}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        testID="invoice-delete-modal"
      />

      <MarkPaidInvoiceModal
        visible={showMarkPaidModal}
        invoiceNumber={invoice.number}
        isMarking={isMarking}
        error={markPaidError}
        disabled={!isOnline}
        onConfirm={handleConfirmMarkPaid}
        onCancel={() => setShowMarkPaidModal(false)}
        testID="invoice-mark-paid-modal"
      />

      <SendInvoiceModal
        visible={showSendModal}
        invoiceNumber={invoice.number}
        defaultTo={invoice.client?.email || ''}
        isSending={isSending}
        error={sendError}
        disabled={!isOnline}
        onSend={handleConfirmSend}
        onCancel={() => setShowSendModal(false)}
        testID="invoice-send-modal"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    marginStart: 8,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionGridBtn: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPrimaryBtn: {
    flex: 1,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    gap: 12,
    width: '100%',
  },
  cardHeaderTitle: {
    marginBottom: 4,
  },
  lineItemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  lineItemDetailText: {
    flex: 1,
    marginEnd: 12,
  },
  totalsBreakdown: {
    paddingTop: 12,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  notesBlock: {
    gap: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backButton: {
    marginTop: 16,
    minWidth: 160,
  },
});
