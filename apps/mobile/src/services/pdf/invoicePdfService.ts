import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { env } from '../../config/env';
import { getSupabaseClient } from '../../auth/supabase';
import { ApiError, handleExpiredSession } from '../../api/client';

export const INVOICE_PDF_CACHE_DIR_PREFIX = 'haseela_invoices_';

let activeGeneration = 0;

/**
 * Invalidates any in-flight download or presentation operations across account changes or sign-out.
 */
export function invalidateActivePdfOperations(): void {
  activeGeneration += 1;
}

export interface DownloadedPdfArtifact {
  readonly uri: string;
  readonly ownerUserId: string;
  readonly generation: number;
}

interface ValidatedArtifactMeta {
  readonly uri: string;
  readonly ownerUserId: string;
  readonly generation: number;
}

const artifactRegistry = new WeakMap<DownloadedPdfArtifact, ValidatedArtifactMeta>();

/**
 * Encodes Uint8Array into a Base64 string for file writing in React Native.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

/**
 * Sanitizes a string for safe use in file/folder names to avoid path traversal.
 */
export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Validates that binary data begins with the %PDF- magic signature (0x25 0x50 0x44 0x46 0x2D).
 */
export function isValidPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  );
}

/**
 * Downloads the actual server PDF with Bearer authentication into the user's private cache directory.
 * - Binds the resulting artifact to BOTH ownerUserId and generation.
 * - Does NOT append tokens in URLs or logs.
 * - Validates HTTP ok, content-type: application/pdf, and %PDF- signature before writing to disk.
 * - Ensures error JSON is never written or shared.
 * - Cleans up session locally on 401 via handleExpiredSession.
 * - Guards late in-flight completion and during-write races against user signout/session change.
 * - Fails closed if cacheDirectory is unavailable.
 */
export async function downloadInvoicePdf(
  invoiceId: string,
  invoiceNumber: string
): Promise<DownloadedPdfArtifact> {
  const initialGen = activeGeneration;
  const client = getSupabaseClient();
  const { data: initialSession } = await client.auth.getSession();
  const initialUserId = initialSession.session?.user?.id;
  const token = initialSession.session?.access_token;

  if (!initialUserId || !token) {
    await handleExpiredSession();
    throw new ApiError(401, 'Unauthorized');
  }

  const cacheBase = FileSystem.cacheDirectory;
  if (!cacheBase) {
    throw new Error('CACHE_UNAVAILABLE');
  }

  const cleanId = encodeURIComponent(invoiceId);
  const url = `${env.apiUrl}/api/invoices/${cleanId}/pdf`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    if (response.status === 401) {
      await handleExpiredSession();
    }
    let message = `HTTP ${response.status}`;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(responseBody);
      if (parsed?.error) message = parsed.error;
      if (parsed?.message) message = parsed.message;
      if (parsed?.code) code = parsed.code;
    } catch {
      if (responseBody) message = responseBody;
    }
    throw new ApiError(response.status, message, code, responseBody);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error('INVALID_PDF_TYPE');
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (!isValidPdfSignature(bytes)) {
    throw new Error('INVALID_PDF_SIGNATURE');
  }

  // Pre-write guard: verify user has not signed out, switched accounts, or invalidated cache while download was in flight
  const { data: midSession } = await client.auth.getSession();
  const currentUserId = midSession.session?.user?.id;
  if (activeGeneration !== initialGen || !currentUserId || currentUserId !== initialUserId) {
    throw new Error('SESSION_CHANGED_ABORTED');
  }

  const safeUserId = sanitizePathSegment(initialUserId);
  const safeNumber = sanitizePathSegment(invoiceNumber || invoiceId);
  const safeId = sanitizePathSegment(invoiceId);
  const userDirUri = `${cacheBase}${INVOICE_PDF_CACHE_DIR_PREFIX}${safeUserId}/`;
  const opId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fileUri = `${userDirUri}invoice_${safeNumber}_${safeId}_gen${initialGen}_${opId}.pdf`;

  await FileSystem.makeDirectoryAsync(userDirUri, { intermediates: true });

  // Guard generation and session identity after makeDirectory await BEFORE writing
  const { data: preWriteSession } = await getSupabaseClient().auth.getSession();
  if (
    activeGeneration !== initialGen ||
    !preWriteSession?.session?.user?.id ||
    preWriteSession.session.user.id !== initialUserId
  ) {
    throw new Error('SESSION_CHANGED_ABORTED');
  }

  const base64Data = uint8ArrayToBase64(bytes);
  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Post-write guard: re-verify user identity and generation (guards against signout DURING write)
  const currentClient = getSupabaseClient();
  const { data: finalSession } = await currentClient.auth.getSession();
  if (
    activeGeneration !== initialGen ||
    !finalSession?.session?.user?.id ||
    finalSession.session.user.id !== initialUserId
  ) {
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // Best-effort cleanup
    }
    throw new Error('SESSION_CHANGED_ABORTED');
  }

  const artifact: DownloadedPdfArtifact = Object.freeze({
    uri: fileUri,
    ownerUserId: initialUserId,
    generation: initialGen,
  });

  artifactRegistry.set(artifact, {
    uri: fileUri,
    ownerUserId: initialUserId,
    generation: initialGen,
  });

  return artifact;
}

function validateArtifact(artifact: DownloadedPdfArtifact): ValidatedArtifactMeta {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('SESSION_CHANGED_ABORTED');
  }
  const meta = artifactRegistry.get(artifact);
  if (!meta) {
    throw new Error('SESSION_CHANGED_ABORTED');
  }
  if (
    meta.uri !== artifact.uri ||
    meta.ownerUserId !== artifact.ownerUserId ||
    meta.generation !== artifact.generation ||
    meta.generation !== activeGeneration
  ) {
    throw new Error('SESSION_CHANGED_ABORTED');
  }
  return meta;
}

/**
 * Opens native print preview / print dialog for local PDF artifact.
 * Fails closed for untracked or expired artifacts.
 * Handles iOS user cancellation without treating it as an error.
 * Checks session identity and generation immediately before presenting native print dialog.
 */
export async function previewAndPrintInvoicePdf(
  artifact: DownloadedPdfArtifact
): Promise<void> {
  const valid = validateArtifact(artifact);

  const client = getSupabaseClient();
  const { data: currentSession } = await client.auth.getSession();
  const currentUserId = currentSession.session?.user?.id;

  if (
    !currentUserId ||
    currentUserId !== valid.ownerUserId ||
    valid.generation !== activeGeneration
  ) {
    throw new Error('SESSION_CHANGED_ABORTED');
  }

  try {
    await Print.printAsync({ uri: valid.uri });
  } catch (error: any) {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '');
    if (
      msg.includes('cancel') ||
      msg.includes('dismiss') ||
      code === 'ERR_PRINT_CANCELLED' ||
      code === '1'
    ) {
      // User canceled or dismissed dialog
      return;
    }
    throw error;
  }
}

/**
 * Shares local PDF file via native system share sheet.
 * Fails closed for untracked or expired artifacts.
 * Re-checks session identity and generation immediately after isAvailableAsync and before presenting native share sheet.
 */
export async function shareInvoicePdf(
  artifact: DownloadedPdfArtifact
): Promise<void> {
  const valid = validateArtifact(artifact);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('SHARING_NOT_AVAILABLE');
  }

  const client = getSupabaseClient();
  const { data: currentSession } = await client.auth.getSession();
  const currentUserId = currentSession.session?.user?.id;

  if (
    !currentUserId ||
    currentUserId !== valid.ownerUserId ||
    valid.generation !== activeGeneration
  ) {
    throw new Error('SESSION_CHANGED_ABORTED');
  }

  await Sharing.shareAsync(valid.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share Invoice PDF',
  });
}

/**
 * Clears exclusively owned invoice PDF cache directory and invalidates active operations.
 * Never deletes other app caches.
 */
export async function clearInvoicePdfCache(): Promise<void> {
  invalidateActivePdfOperations();
  const cacheBase = FileSystem.cacheDirectory;
  if (!cacheBase) return;

  try {
    const info = await FileSystem.getInfoAsync(cacheBase);
    if (!info.exists) return;

    const entries = await FileSystem.readDirectoryAsync(cacheBase);
    for (const entry of entries) {
      if (entry.startsWith(INVOICE_PDF_CACHE_DIR_PREFIX)) {
        await FileSystem.deleteAsync(`${cacheBase}${entry}`, { idempotent: true });
      }
    }
  } catch {
    // Best-effort cleanup
  }
}
