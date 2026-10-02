import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  downloadInvoicePdf,
  previewAndPrintInvoicePdf,
  shareInvoicePdf,
  clearInvoicePdfCache,
  isValidPdfSignature,
  sanitizePathSegment,
  INVOICE_PDF_CACHE_DIR_PREFIX,
  type DownloadedPdfArtifact,
} from '../invoicePdfService';
import { clearQueryAndPersistedCache } from '../../../query/queryClient';
import { setSupabaseClientForTesting } from '../../../auth/supabase';
import { ApiError } from '../../../api/client';
import { MOCK_PDF_BYTES } from '../../../test/mockInvoiceServer';

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

describe('Invoice PDF Service & Cache Management', () => {
  let mockSession = {
    session: {
      access_token: 'test-valid-bearer-token',
      user: { id: 'usr-42' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheDirectory = 'file:///app-cache/';
    mockSession = {
      session: {
        access_token: 'test-valid-bearer-token',
        user: { id: 'usr-42' },
      },
    };

    setSupabaseClientForTesting({
      auth: {
        getSession: jest.fn().mockImplementation(() => Promise.resolve({ data: mockSession })),
        signOut: jest.fn().mockResolvedValue({ error: null }),
      },
    } as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Validation & Helpers', () => {
    it('validates %PDF- signature correctly', () => {
      expect(isValidPdfSignature(MOCK_PDF_BYTES)).toBe(true);
      expect(isValidPdfSignature(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe(false);
      expect(isValidPdfSignature(new TextEncoder().encode('{"error":"Not found"}'))).toBe(false);
    });

    it('sanitizes path segment against path traversal', () => {
      expect(sanitizePathSegment('../../../etc/passwd')).toBe('_________etc_passwd');
      expect(sanitizePathSegment('INV-0044/2026')).toBe('INV-0044_2026');
    });
  });

  describe('downloadInvoicePdf', () => {
    it('downloads actual server PDF with Bearer header and returns bound artifact', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};

      global.fetch = jest.fn().mockImplementation((url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers || {};
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
          text: async () => '',
        } as Response);
      });

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      expect(capturedUrl).toContain('/api/invoices/inv-123/pdf');
      expect(capturedHeaders['Authorization']).toBe('Bearer test-valid-bearer-token');
      expect(capturedHeaders['Accept']).toBe('application/pdf');

      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining('file:///app-cache/haseela_invoices_usr-42/'),
        { intermediates: true }
      );
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/file:\/\/\/app-cache\/haseela_invoices_usr-42\/invoice_INV-0042_inv-123_gen\d+_[a-z0-9_]+\.pdf$/),
        expect.any(String),
        { encoding: 'base64' }
      );
      expect(artifact.uri).toMatch(/invoice_INV-0042_inv-123_gen\d+_[a-z0-9_]+\.pdf$/);
      expect(artifact.ownerUserId).toBe('usr-42');
      expect(typeof artifact.generation).toBe('number');
    });

    it('throws ApiError and cleans session on 401 response without writing file', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Unauthorized' }),
      } as Response);

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow(ApiError);
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('rejects 404/503 responses and never writes error JSON to file', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: 'Email/PDF service unavailable', code: 'smtp_not_configured' }),
      } as Response);

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('Email/PDF service unavailable');
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('rejects non-pdf content type', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new TextEncoder().encode('<html>Error</html>').buffer,
        text: async () => '<html>Error</html>',
      } as Response);

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('INVALID_PDF_TYPE');
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('rejects invalid PDF signature', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]).buffer,
        text: async () => '',
      } as Response);

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('INVALID_PDF_SIGNATURE');
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('aborts and cleans up if session changes during in-flight download', async () => {
      let callCount = 0;
      setSupabaseClientForTesting({
        auth: {
          getSession: jest.fn().mockImplementation(() => {
            callCount += 1;
            if (callCount === 1) {
              return Promise.resolve({ data: { session: { access_token: 'tok-1', user: { id: 'usr-1' } } } });
            }
            // User switched accounts mid-flight
            return Promise.resolve({ data: { session: { access_token: 'tok-2', user: { id: 'usr-2' } } } });
          }),
        },
      } as any);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('cleans up written file if signout occurs DURING filesystem write', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      // Simulate signout occurring DURING writeAsStringAsync
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementationOnce(async () => {
        mockSession = { session: null as any };
      });

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('SESSION_CHANGED_ABORTED');
      // Assert abandoned file was deleted
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringMatching(/invoice_INV-0042_inv-123_gen\d+_[a-z0-9_]+\.pdf$/),
        { idempotent: true }
      );
    });

    it('fails closed if cacheDirectory is null', async () => {
      mockCacheDirectory = null;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('CACHE_UNAVAILABLE');
      mockCacheDirectory = 'file:///app-cache/';
    });

    it('invalidates in-flight download if cache cleared / signout occurs mid-flight even if same user signs back in', async () => {
      global.fetch = jest.fn().mockImplementation(async () => {
        // Invalidate operations mid-flight (as done on signout / clear cache)
        await clearInvoicePdfCache();
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
          text: async () => '',
        } as Response;
      });

      await expect(downloadInvoicePdf('inv-123', 'INV-0042')).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });
  });

  describe('previewAndPrintInvoicePdf', () => {
    it('calls Print.printAsync with valid artifact', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');
      await previewAndPrintInvoicePdf(artifact);
      expect(Print.printAsync).toHaveBeenCalledWith({ uri: artifact.uri });
    });

    it('aborts presentation if user identity changed before print', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      // User switched
      setSupabaseClientForTesting({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { access_token: 'other-token', user: { id: 'usr-different' } } },
          }),
        },
      } as any);

      await expect(previewAndPrintInvoicePdf(artifact)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Print.printAsync).not.toHaveBeenCalled();
    });

    it('aborts print if same user signs out and back in between download and presentation', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      // Same user signs out and back in (cache cleared)
      await clearInvoicePdfCache();
      setSupabaseClientForTesting({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { access_token: 'new-token', user: { id: 'usr-42' } } },
          }),
        },
      } as any);

      await expect(previewAndPrintInvoicePdf(artifact)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Print.printAsync).not.toHaveBeenCalled();
    });

    it('fails closed for forged or modified artifact while original works', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const originalArtifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      // Forged copy with same generation and owner, but different uri
      const forged = {
        uri: 'file:///etc/passwd',
        ownerUserId: originalArtifact.ownerUserId,
        generation: originalArtifact.generation,
      };

      await expect(previewAndPrintInvoicePdf(forged as any)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      await expect(shareInvoicePdf(forged as any)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Print.printAsync).not.toHaveBeenCalled();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();

      // Original artifact still works!
      await expect(previewAndPrintInvoicePdf(originalArtifact)).resolves.toBeUndefined();
      expect(Print.printAsync).toHaveBeenCalledWith({ uri: originalArtifact.uri });
    });

    it('aborts Print if same user logs out and logs back in DURING getSession preflight', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      // Mock getSession so that DURING its resolution, the user logs out and back in
      setSupabaseClientForTesting({
        auth: {
          getSession: jest.fn().mockImplementation(async () => {
            // Same user logs out and back in while preflight is in flight
            await clearInvoicePdfCache();
            return {
              data: { session: { access_token: 'new-token', user: { id: 'usr-42' } } },
              error: null,
            };
          }),
        },
      } as any);

      await expect(previewAndPrintInvoicePdf(artifact)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Print.printAsync).not.toHaveBeenCalled();
    });

    it('deferred FS race: old write resolving late deletes ONLY old URI and does not corrupt fresh download', async () => {
      let resolveOldWrite: () => void = () => {};
      const oldWriteDeferred = new Promise<void>((resolve) => {
        resolveOldWrite = resolve;
      });

      let signalWriteStarted: () => void = () => {};
      const writeStartedPromise = new Promise<void>((r) => {
        signalWriteStarted = r;
      });

      let writeCallCount = 0;
      (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(() => {
        writeCallCount += 1;
        if (writeCallCount === 1) {
          signalWriteStarted();
          return oldWriteDeferred;
        }
        return Promise.resolve();
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      // 1. Start old download
      const oldDownloadPromise = downloadInvoicePdf('inv-1', 'INV-0044');
      await writeStartedPromise; // Wait until old download is actively writing!

      // 2. Invalidate cache / sign in same user ID
      await clearInvoicePdfCache();

      // 3. Perform fresh download in new generation
      const freshArtifact = await downloadInvoicePdf('inv-1', 'INV-0044');
      expect(freshArtifact.uri).toBeDefined();

      // 4. Old write resolves
      resolveOldWrite();
      await expect(oldDownloadPromise).rejects.toThrow('SESSION_CHANGED_ABORTED');

      // 5. Assert deleteAsync only deleted old file URI, NOT freshArtifact.uri!
      expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith(freshArtifact.uri, expect.anything());

      // 6. Fresh artifact can still Print and Share
      await expect(previewAndPrintInvoicePdf(freshArtifact)).resolves.toBeUndefined();
      expect(Print.printAsync).toHaveBeenCalledWith({ uri: freshArtifact.uri });
    });

    it('fails closed for untracked or expired artifact', async () => {
      await expect(
        previewAndPrintInvoicePdf({ uri: 'file:///fake.pdf', ownerUserId: 'usr-42', generation: 9999 })
      ).rejects.toThrow('SESSION_CHANGED_ABORTED');
      await expect(previewAndPrintInvoicePdf(null as any)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Print.printAsync).not.toHaveBeenCalled();
    });

    it('swallows iOS user cancellation without throwing', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');
      (Print.printAsync as jest.Mock).mockRejectedValueOnce(new Error('The user canceled the print operation'));
      await expect(previewAndPrintInvoicePdf(artifact)).resolves.toBeUndefined();
    });

    it('rethrows unexpected print errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');
      (Print.printAsync as jest.Mock).mockRejectedValueOnce(new Error('Printer paper jam'));
      await expect(previewAndPrintInvoicePdf(artifact)).rejects.toThrow('Printer paper jam');
    });
  });

  describe('shareInvoicePdf', () => {
    it('calls Sharing.shareAsync when available', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
      await shareInvoicePdf(artifact);

      expect(Sharing.shareAsync).toHaveBeenCalledWith(artifact.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Share Invoice PDF',
      });
    });

    it('aborts share if same user signs out and back in while isAvailableAsync is resolving', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      (Sharing.isAvailableAsync as jest.Mock).mockImplementation(async () => {
        // Same user signs out and back in (generation incremented)
        await clearInvoicePdfCache();
        setSupabaseClientForTesting({
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: { access_token: 'new-token', user: { id: 'usr-42' } } },
            }),
          },
        } as any);
        return true;
      });

      await expect(shareInvoicePdf(artifact)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it('throws SHARING_NOT_AVAILABLE if sharing is not supported on device', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
      await expect(shareInvoicePdf(artifact)).rejects.toThrow('SHARING_NOT_AVAILABLE');
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });
  });

  describe('Cache Cleanup & Isolation', () => {
    it('clearInvoicePdfCache only deletes directories starting with haseela_invoices_', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
        'haseela_invoices_usr-1',
        'haseela_invoices_usr-2',
        'some_other_app_cache_folder',
        'user_profile_avatars',
      ]);

      await clearInvoicePdfCache();

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///app-cache/haseela_invoices_usr-1', { idempotent: true });
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///app-cache/haseela_invoices_usr-2', { idempotent: true });
      expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///app-cache/some_other_app_cache_folder', expect.anything());
      expect(FileSystem.deleteAsync).not.toHaveBeenCalledWith('file:///app-cache/user_profile_avatars', expect.anything());
    });

    it('clearQueryAndPersistedCache invokes clearInvoicePdfCache on signout', async () => {
      (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce([
        'haseela_invoices_usr-42',
      ]);

      await clearQueryAndPersistedCache();

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///app-cache/haseela_invoices_usr-42',
        { idempotent: true }
      );
    });

    it('clearQueryAndPersistedCache invalidates native presentations immediately even if AsyncStorage removal hangs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () => MOCK_PDF_BYTES.buffer,
        text: async () => '',
      } as Response);

      const artifact = await downloadInvoicePdf('inv-123', 'INV-0042');

      // Mock AsyncStorage removal hanging
      let resolveAsyncStorage: () => void = () => {};
      const asyncStoragePromise = new Promise<void>((resolve) => {
        resolveAsyncStorage = resolve;
      });
      jest.spyOn(AsyncStorage, 'removeItem').mockReturnValueOnce(asyncStoragePromise as any);

      // Start clearQueryAndPersistedCache (unresolved)
      const clearPromise = clearQueryAndPersistedCache();

      // Print and Share must fail immediately without waiting for AsyncStorage to resolve!
      await expect(previewAndPrintInvoicePdf(artifact)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      await expect(shareInvoicePdf(artifact)).rejects.toThrow('SESSION_CHANGED_ABORTED');
      expect(Print.printAsync).not.toHaveBeenCalled();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();

      // Resolve cleanup
      resolveAsyncStorage();
      await clearPromise;
    });
  });
});
