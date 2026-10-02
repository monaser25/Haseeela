import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import InvoiceDetailScreen from '../(app)/invoice/[id]';
import NewInvoiceScreen from '../(app)/invoice/new';
import { ThemeProvider } from '../../theme';
import { I18nProvider } from '../../i18n';
import * as onlineModule from '../../query/useIsOnline';
import { setSupabaseClientForTesting } from '../../auth/supabase';
import type { Invoice } from '@haseela/shared';
import {
  mockServer,
  mockInvoiceStore,
  setupMockInvoiceServer,
  createTestQueryClient,
  setNetworkOnline,
  resetNetworkOnline,
  defaultMockPreferences,
  defaultMockClients,
} from '../../test';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams = { id: 'inv-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../../auth', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
    status: 'signedIn',
    signOut: jest.fn(),
  }),
}));

// Mock ONLY external native module boundaries
let mockCacheDirectory: string | null = 'file:///app-cache/';

jest.mock('expo-file-system/legacy', () => ({
  get cacheDirectory() {
    return mockCacheDirectory;
  },
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-print', () => ({
  printAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const originalFetch = global.fetch;

describe('Invoice Detail, Creation & Management', () => {
  let testQueryClient: ReturnType<typeof createTestQueryClient>;
  let unregisterMock: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'inv-1' };
    mockCacheDirectory = 'file:///app-cache/';
    setNetworkOnline(true);

    mockServer.reset({
      preferences: defaultMockPreferences,
      clients: defaultMockClients,
    });
    mockInvoiceStore.reset();
    unregisterMock = setupMockInvoiceServer(mockServer);
    global.fetch = mockServer.fetchHandler;

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: { access_token: 'test-token', user: { id: 'user-123' } },
          },
          error: null,
        }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    } as any);

    testQueryClient = createTestQueryClient();
  });

  afterEach(async () => {
    cleanup();
    unregisterMock();
    global.fetch = originalFetch;
    act(() => {
      resetNetworkOnline();
    });
    testQueryClient.cancelQueries();
    testQueryClient.clear();
    testQueryClient.getMutationCache().clear();
  });

  const wrapper = ({ children }: { children: any }) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={testQueryClient}>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  describe('New Invoice Creation Flow & Input Validation', () => {
    it('per-case validation: rejects empty description and shows visible error with zero POST', async () => {
      const { getByTestId, findByTestId, findByText } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      const rateInput = getByTestId('line-item-rate-0');
      fireEvent.changeText(descInput, '');
      fireEvent.changeText(rateInput, '100');

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      fireEvent.press(saveBtn);

      expect(await findByText('Add at least one line item with a description.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/invoices/create')).toBe(0);
    });

    it('per-case validation: rejects invalid/negative quantity and shows visible error with zero POST', async () => {
      const { getByTestId, findByTestId, findByText } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      const qtyInput = getByTestId('line-item-qty-0');
      fireEvent.changeText(descInput, 'Web Consulting');
      fireEvent.changeText(qtyInput, '0');

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      fireEvent.press(saveBtn);

      expect(await findByText('Quantity must be greater than 0.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/invoices/create')).toBe(0);
    });

    it('per-case validation: rejects negative rate and shows visible error with zero POST', async () => {
      const { getByTestId, findByTestId, findByText } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      const rateInput = getByTestId('line-item-rate-0');
      fireEvent.changeText(descInput, 'Web Consulting');
      fireEvent.changeText(rateInput, '-50');

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      fireEvent.press(saveBtn);

      expect(await findByText('Rate cannot be negative.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/invoices/create')).toBe(0);
    });

    it('per-case validation: rejects due date before issue date and shows visible error with zero POST', async () => {
      const { getByTestId, findByTestId, findByText } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      const rateInput = getByTestId('line-item-rate-0');
      fireEvent.changeText(descInput, 'Web Consulting');
      fireEvent.changeText(rateInput, '100');

      // Change due date to past date before issue date
      const duePicker = getByTestId('invoice-due-date-picker');
      fireEvent.press(duePicker);
      const nativePicker = getByTestId('date-time-picker');
      fireEvent(nativePicker, 'onChange', { type: 'set' }, new Date('2020-01-01'));

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      fireEvent.press(saveBtn);

      expect(await findByText('Due date must be on or after issue date.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/invoices/create')).toBe(0);
    });

    it('per-case validation: rejects tax rate > 100% and negative discount with visible errors with zero POST', async () => {
      const { getByTestId, findByTestId, findByText } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      const rateInput = getByTestId('line-item-rate-0');
      const taxInput = getByTestId('invoice-tax-rate-input');
      const discountInput = getByTestId('invoice-discount-input');

      fireEvent.changeText(descInput, 'Web Consulting');
      fireEvent.changeText(rateInput, '100');
      fireEvent.changeText(taxInput, '150');
      fireEvent.changeText(discountInput, '-20');

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      fireEvent.press(saveBtn);

      expect(await findByText('Tax rate must be between 0% and 100%.')).toBeTruthy();
      expect(await findByText('Discount cannot be negative.')).toBeTruthy();
      expect(mockServer.getRequestCount('POST', '/api/invoices/create')).toBe(0);
    });

    it('creates draft invoice with computed totals, asserts saved body on server, and navigates', async () => {
      const { getByTestId, findByTestId } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      const qtyInput = getByTestId('line-item-qty-0');
      const rateInput = getByTestId('line-item-rate-0');
      const taxInput = getByTestId('invoice-tax-rate-input');
      const discountInput = getByTestId('invoice-discount-input');

      // Item: 2 x 1500 = 3000, discount = 200 -> 2800, tax 10% = 280 -> total = 3080
      fireEvent.changeText(descInput, 'Mobile Design System');
      fireEvent.changeText(qtyInput, '2');
      fireEvent.changeText(rateInput, '1500');
      fireEvent.changeText(taxInput, '10');
      fireEvent.changeText(discountInput, '200');

      // Assert visible numeric live totals
      expect(getByTestId('live-subtotal-val').props.children).toContain('3,000');
      expect(getByTestId('live-total-val').props.children).toContain('3,080');

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(expect.stringMatching(/^\/\(app\)\/invoice\/inv-/));
      });

      expect(mockServer.getRequestCount('POST', '/api/invoices/create')).toBe(1);
      const createReq = mockServer.getWriteRequests().find((r) => r.path === '/api/invoices/create');
      expect(createReq?.body.status).toBe('DRAFT');
      expect(createReq?.body.lineItems[0].description).toBe('Mobile Design System');
      expect(createReq?.body.taxRate).toBe(10);
      expect(createReq?.body.discount).toBe(200);
    });

    it('create unexpected HTTP failure renders localized generic error and raw marker is absent', async () => {
      const { getByTestId, findByTestId, findByText } = render(<NewInvoiceScreen />, { wrapper });
      await findByTestId('new-invoice-screen');

      const descInput = await findByTestId('line-item-desc-0');
      fireEvent.changeText(descInput, 'Valid Title');
      const rateInput = getByTestId('line-item-rate-0');
      fireEvent.changeText(rateInput, '100');

      // Inject raw technical backend error marker via HTTP
      mockServer.setErrorOnce('/api/invoices/create', 500, {
        error: 'RAW_PG_INSERT_VIOLATION_0xCAFE',
      });

      const saveBtn = getByTestId('new-invoice-save-draft-btn');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      // Localized retryable error rendered
      const errorText = await findByText('Failed to save invoice');
      expect(errorText).toBeTruthy();
      expect(errorText.props.children).toBe('Failed to save invoice');
      expect(errorText.props.children).not.toContain('RAW_PG_INSERT_VIOLATION_0xCAFE');
    });
  });

  describe('Invoice Detail Screen & Real Native Boundaries', () => {
    it('displays invoice hero, client details, line items, and real timeline', async () => {
      mockParams = { id: 'inv-1' };
      const { findByTestId, findByText } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      expect(await findByText('#INV-0044')).toBeTruthy();
      expect(await findByText('Acme Corp')).toBeTruthy();
      expect(await findByText('Brand Identity Strategy')).toBeTruthy();
      expect(await findByTestId('invoice-detail-timeline-card')).toBeTruthy();
    });

    it('downloads server PDF and invokes native Print with accurate cache URI', async () => {
      mockParams = { id: 'inv-1' };
      const { findByTestId, getByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      const printBtn = getByTestId('invoice-print-pdf-btn');
      await act(async () => {
        fireEvent.press(printBtn);
      });

      // Verify real download and FileSystem write
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/invoice_INV-0044_inv-1_gen\d+_[a-z0-9_]+\.pdf$/),
        expect.any(String),
        { encoding: 'base64' }
      );

      // Verify Print.printAsync called with local cache URI
      expect(Print.printAsync).toHaveBeenCalledWith({
        uri: expect.stringMatching(/invoice_INV-0044_inv-1_gen\d+_[a-z0-9_]+\.pdf$/),
      });
    });

    it('downloads server PDF and invokes native Share with application/pdf MIME', async () => {
      mockParams = { id: 'inv-1' };
      const { findByTestId, getByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      const shareBtn = getByTestId('invoice-share-pdf-btn');
      await act(async () => {
        fireEvent.press(shareBtn);
      });

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/invoice_INV-0044_inv-1_gen\d+_[a-z0-9_]+\.pdf$/),
        expect.objectContaining({
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        })
      );
    });

    it('PDF error display maps to translated text and excludes raw internal error tokens', async () => {
      // Simulate server 500 error on PDF download
      mockServer.setErrorOnce('/api/invoices/inv-1/pdf', 500, { error: 'PDF engine failure' });

      mockParams = { id: 'inv-1' };
      const { findByTestId, getByTestId, findByText } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      const printBtn = getByTestId('invoice-print-pdf-btn');
      await act(async () => {
        fireEvent.press(printBtn);
      });

      // User-friendly translated error banner appears
      const bannerText = await findByText('Could not download invoice PDF');
      expect(bannerText).toBeTruthy();
      expect(bannerText.props.children).toBe('Could not download invoice PDF');
      expect(bannerText.props.children).not.toContain('CACHE_UNAVAILABLE');
      expect(bannerText.props.children).not.toContain('INVALID_PDF_TYPE');
      expect(bannerText.props.children).not.toContain('INVALID_PDF_SIGNATURE');
      expect(bannerText.props.children).not.toContain('SESSION_CHANGED_ABORTED');
    });

    it('MarkPaid failure displays translated generic error, modal stays open, and retry succeeds', async () => {
      mockParams = { id: 'inv-2' };
      const { findByTestId, getByTestId, findByText, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      const markPaidActionBtn = getByTestId('invoice-mark-paid-action-btn');
      fireEvent.press(markPaidActionBtn);

      expect(getByTestId('invoice-mark-paid-modal')).toBeTruthy();

      // Inject server error once
      mockServer.setErrorOnce('/api/invoices/inv-2/mark-paid', 500, { error: 'Bank gateway timeout' });

      const confirmBtn = getByTestId('confirm-mark-paid-btn');
      await act(async () => {
        fireEvent.press(confirmBtn);
      });

      // Error banner rendered INSIDE modal with translated generic text
      expect(await findByText('Failed to mark paid')).toBeTruthy();
      expect(getByTestId('mark-paid-error-banner')).toBeTruthy();

      // Retry: confirm again without closing modal
      await act(async () => {
        fireEvent.press(confirmBtn);
      });

      // Succeeded! Modal closed and invoice marked paid
      await waitFor(() => {
        expect(queryByTestId('invoice-mark-paid-modal')).toBeNull();
        expect(mockInvoiceStore.findInvoice('inv-2')?.status).toBe('PAID');
      });
    });

    it('Delete failure displays translated generic error, modal stays open, and retry succeeds', async () => {
      mockParams = { id: 'inv-4' };
      const { findByTestId, getByTestId, findByText, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      const deleteBtn = getByTestId('invoice-delete-btn');
      fireEvent.press(deleteBtn);

      expect(getByTestId('invoice-delete-modal')).toBeTruthy();

      // Inject server error once
      mockServer.setErrorOnce('/api/invoices/delete/inv-4', 500, { error: 'Database locked' });

      const confirmDeleteBtn = getByTestId('confirm-delete-invoice-btn');
      await act(async () => {
        fireEvent.press(confirmDeleteBtn);
      });

      // Error banner rendered INSIDE modal with translated generic text
      expect(await findByText('Failed to delete')).toBeTruthy();
      expect(getByTestId('delete-invoice-error-banner')).toBeTruthy();

      // Retry: confirm again
      await act(async () => {
        fireEvent.press(confirmDeleteBtn);
      });

      // Succeeded! Invoice deleted and back navigated
      await waitFor(() => {
        expect(mockInvoiceStore.findInvoice('inv-4')).toBeUndefined();
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it('HTTP-deferred pending locks back navigation and dismiss without conflict', async () => {
      mockParams = { id: 'inv-4' };
      const { findByTestId, getByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      fireEvent.press(getByTestId('invoice-delete-btn'));
      expect(getByTestId('invoice-delete-modal')).toBeTruthy();

      // Defer HTTP DELETE response
      mockServer.setPending('/api/invoices/delete/inv-4');

      const confirmBtn = getByTestId('confirm-delete-invoice-btn');
      fireEvent.press(confirmBtn);

      // During pending state: cancel button is locked
      const cancelBtn = getByTestId('cancel-delete-invoice-btn');
      expect(cancelBtn.props.accessibilityState.disabled).toBe(true);

      // Back button in header is locked
      const backBtn = getByTestId('invoice-detail-back-btn');
      expect(backBtn.props.accessibilityState.disabled).toBe(true);

      // Duplicate confirm press while pending does not trigger additional requests
      fireEvent.press(confirmBtn);

      // Cross action while pending does not trigger action
      const printBtn = getByTestId('invoice-print-pdf-btn');
      fireEvent.press(printBtn);
      expect(Print.printAsync).not.toHaveBeenCalled();

      // Resolve pending response
      await act(async () => {
        mockServer.resolvePending('/api/invoices/delete/inv-4', { id: 'inv-4' });
      });

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      // Assert exactly one DELETE, zero markpaid, zero send, zero PUT, zero native
      expect(mockServer.getRequestCount('DELETE', '/api/invoices/delete/inv-4')).toBe(1);
      expect(mockServer.getRequestCount('POST', '/api/invoices/inv-4/mark-paid')).toBe(0);
      expect(mockServer.getRequestCount('POST', '/api/invoices/inv-4/send')).toBe(0);
      expect(mockServer.getRequestCount('PUT', '/api/invoices/update/inv-4')).toBe(0);
      expect(Print.printAsync).not.toHaveBeenCalled();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it('modal opened online then disconnect: confirmation is visibly disabled and zero writes occur', async () => {
      // Seed scoped cache
      testQueryClient.setQueryData(['invoices', 'user-123', 'inv-2'], mockInvoiceStore.findInvoice('inv-2'));
      mockParams = { id: 'inv-2' };

      const { findByTestId, getByTestId, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      // Open Send modal while online
      fireEvent.press(getByTestId('invoice-send-action-btn'));
      expect(getByTestId('invoice-send-modal')).toBeTruthy();

      // Genuine offline transition via TanStack Query onlineManager
      await act(async () => {
        setNetworkOnline(false);
      });

      // Confirm button is visibly disabled
      const confirmBtn = getByTestId('confirm-send-invoice-btn');
      expect(confirmBtn.props.accessibilityState.disabled).toBe(true);

      // Pressing confirm does not perform write
      fireEvent.press(confirmBtn);
      expect(mockServer.getRequestCount('POST', '/api/invoices/inv-2/send')).toBe(0);

      // Cancel button remains accessible while offline
      const cancelBtn = getByTestId('cancel-send-invoice-btn');
      expect(cancelBtn.props.accessibilityState.disabled).toBe(false);

      // Reconnect online
      await act(async () => {
        setNetworkOnline(true);
      });

      // Settled reconnect assertion: zero writes until fresh intentional confirm
      expect(mockServer.getRequestCount('POST', '/api/invoices/inv-2/send')).toBe(0);

      // Fresh intentional confirm succeeds once
      const confirmBtnAfter = getByTestId('confirm-send-invoice-btn');
      expect(confirmBtnAfter.props.accessibilityState.disabled).toBe(false);
      await act(async () => {
        fireEvent.press(confirmBtnAfter);
      });

      await waitFor(() => {
        expect(queryByTestId('invoice-send-modal')).toBeNull();
      });
      expect(mockServer.getRequestCount('POST', '/api/invoices/inv-2/send')).toBe(1);
    });

    it('HTTP-driven PAID transition while editing exits edit mode without PUT request', async () => {
      mockParams = { id: 'inv-2' }; // initially SENT
      const { findByTestId, getByTestId, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      // Enter edit mode
      fireEvent.press(getByTestId('invoice-edit-btn'));
      expect(await findByTestId('invoice-edit-form-fields')).toBeTruthy();

      // User makes dirty edits
      const descInput = await findByTestId('line-item-desc-0');
      fireEvent.changeText(descInput, 'Unsaved dirty draft');

      // Server updates invoice to PAID via HTTP fixture
      mockInvoiceStore.setInvoices(
        mockInvoiceStore.getInvoices().map((inv) =>
          inv.id === 'inv-2' ? { ...inv, status: 'PAID', paidAt: new Date().toISOString() } : inv
        )
      );

      // Trigger HTTP refetch from server (not setQueryData)
      await act(async () => {
        await testQueryClient.refetchQueries({ queryKey: ['invoices', 'user-123', 'inv-2'] });
      });

      // Edit mode automatically exited without user saving, paid status preserved, zero PUTs
      await waitFor(() => {
        expect(queryByTestId('invoice-edit-form-fields')).toBeNull();
        expect(getByTestId('invoice-detail-hero-card')).toBeTruthy();
      }, { timeout: 3000 });
      expect(mockServer.getRequestCount('PUT', '/api/invoices/update/inv-2')).toBe(0);
      expect(mockInvoiceStore.findInvoice('inv-2')?.status).toBe('PAID');
    }, 10000);

    it('HTTP-driven missing transition while editing exits edit mode without PUT request', async () => {
      mockParams = { id: 'inv-4' }; // initially DRAFT
      const { findByTestId, getByTestId, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      // Enter edit mode
      fireEvent.press(getByTestId('invoice-edit-btn'));
      expect(await findByTestId('invoice-edit-form-fields')).toBeTruthy();

      // Server deletes invoice via HTTP fixture
      mockInvoiceStore.setInvoices(mockInvoiceStore.getInvoices().filter((i) => i.id !== 'inv-4'));

      // Trigger HTTP refetch
      await act(async () => {
        await testQueryClient.refetchQueries({ queryKey: ['invoices', 'user-123', 'inv-4'] });
      });

      // Edit mode exited, not-found screen shown, zero PUTs
      await waitFor(() => {
        expect(queryByTestId('invoice-edit-form-fields')).toBeNull();
        expect(getByTestId('invoice-detail-not-found-screen')).toBeTruthy();
      }, { timeout: 3000 });
      expect(mockServer.getRequestCount('PUT', '/api/invoices/update/inv-4')).toBe(0);
    }, 10000);

    it('successful UI edit/save persists content, preserves original SENT status, and matches raw-API response', async () => {
      mockParams = { id: 'inv-2' }; // initially SENT
      const { findByTestId, getByTestId, findByText, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      // Enter edit mode
      fireEvent.press(getByTestId('invoice-edit-btn'));
      const descInput = await findByTestId('line-item-desc-0');
      const taxInput = getByTestId('invoice-tax-rate-input');

      fireEvent.changeText(descInput, 'Updated Full Stack Architecture');
      fireEvent.changeText(taxInput, '15');

      const saveBtn = getByTestId('invoice-save-edit-btn');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      // Returns to detail view with updated text
      expect(await findByText('Updated Full Stack Architecture')).toBeTruthy();
      expect(queryByTestId('invoice-edit-form-fields')).toBeNull();

      // Assert PUT request sent with preserved SENT status (never client writing DRAFT or PAID)
      expect(mockServer.getRequestCount('PUT', '/api/invoices/update/inv-2')).toBe(1);
      const putReq = mockServer.getWriteRequests().find((r) => r.path === '/api/invoices/update/inv-2');
      expect(putReq?.body.status).toBe('SENT');
      expect(putReq?.body.lineItems[0].description).toBe('Updated Full Stack Architecture');
      expect(putReq?.body.taxRate).toBe(15);
    });

    it('edit save unexpected HTTP failure renders localized generic error and raw marker is absent', async () => {
      mockParams = { id: 'inv-2' };
      const { findByTestId, getByTestId, findByText } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      fireEvent.press(getByTestId('invoice-edit-btn'));
      const descInput = await findByTestId('line-item-desc-0');
      fireEvent.changeText(descInput, 'Edit With Error');

      // Inject raw technical backend error marker via HTTP
      mockServer.setErrorOnce('/api/invoices/update/inv-2', 500, {
        error: 'RAW_PG_DATABASE_EXCEPTION_0xDEADBEEF',
      });

      const saveBtn = getByTestId('invoice-save-edit-btn');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      // Localized retryable error rendered
      const errorText = await findByText('Failed to save invoice');
      expect(errorText).toBeTruthy();
      expect(errorText.props.children).toBe('Failed to save invoice');
      expect(errorText.props.children).not.toContain('RAW_PG_DATABASE_EXCEPTION_0xDEADBEEF');
    });

    it('canceling edit mode discards draft without saving', async () => {
      mockParams = { id: 'inv-4' }; // DRAFT
      const { findByTestId, getByTestId, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');

      fireEvent.press(getByTestId('invoice-edit-btn'));
      const descInput = await findByTestId('line-item-desc-0');
      fireEvent.changeText(descInput, 'Dirty Draft Text');

      // Cancel
      const cancelBtn = getByTestId('invoice-detail-back-btn');
      fireEvent.press(cancelBtn);

      expect(queryByTestId('invoice-edit-form-fields')).toBeNull();
      expect(mockServer.getRequestCount('PUT', '/api/invoices/update/inv-4')).toBe(0);
      expect(mockInvoiceStore.findInvoice('inv-4')?.lineItems[0].description).toBe('Consultation & Auditing');
    });

    it('preserves cached invoice detail with stale banner on background refetch failure', async () => {
      mockParams = { id: 'inv-1' };
      const { findByTestId, getByTestId, queryByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');
      expect(getByTestId('invoice-detail-hero-card')).toBeTruthy();

      // Inject server error on refetch
      mockServer.setError('/api/invoices', 500, { error: 'Database down' });

      await act(async () => {
        await testQueryClient.refetchQueries({ queryKey: ['invoices', 'user-123', 'inv-1'] });
      });

      // Detail card remains visible; stale banner rendered with retry button
      await waitFor(() => {
        expect(getByTestId('invoice-detail-stale-banner')).toBeTruthy();
        expect(queryByTestId('invoice-detail-hero-card')).toBeTruthy();
      });

      // Test retry clears stale error
      mockServer.clearError('/api/invoices');
      await act(async () => {
        fireEvent.press(getByTestId('invoice-detail-stale-retry-btn'));
      });

      await waitFor(() => {
        expect(queryByTestId('invoice-detail-stale-banner')).toBeNull();
      });
    });

    it('shows cold offline screen when detail accessed offline without cache', async () => {
      act(() => {
        setNetworkOnline(false);
      });
      mockParams = { id: 'cold-missing-inv' };

      const { findByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      expect(await findByTestId('invoice-detail-offline-screen')).toBeTruthy();
      act(() => {
        setNetworkOnline(true);
      });
    });

    it('shows honest not-found screen when invoice does not exist', async () => {
      mockParams = { id: 'non-existent-inv' };
      const { findByTestId, getByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      expect(await findByTestId('invoice-detail-not-found-screen')).toBeTruthy();
      fireEvent.press(getByTestId('invoice-not-found-back-btn'));
      expect(mockBack).toHaveBeenCalled();
    });

    it('disables actions while offline (0 network write requests)', async () => {
      // Seed cache before going offline
      testQueryClient.setQueryData(['invoices', 'user-123', 'inv-1'], mockInvoiceStore.findInvoice('inv-1'));
      mockParams = { id: 'inv-1' };
      act(() => {
        setNetworkOnline(false);
      });

      const { findByTestId, getByTestId } = render(<InvoiceDetailScreen />, { wrapper });

      await findByTestId('invoice-detail-screen');
      expect(getByTestId('invoice-detail-offline-banner')).toBeTruthy();

      // Print PDF button is disabled
      const printBtn = getByTestId('invoice-print-pdf-btn');
      fireEvent.press(printBtn);
      expect(Print.printAsync).not.toHaveBeenCalled();

      // Delete button is disabled
      const deleteBtn = getByTestId('invoice-delete-btn');
      fireEvent.press(deleteBtn);
      expect(mockServer.getWriteRequests()).toHaveLength(0);
      act(() => {
        setNetworkOnline(true);
      });
    });
  });
});
