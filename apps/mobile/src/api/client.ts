import type {
  Client,
  CurrencyCode,
  Subscription,
  Transaction,
  NotificationItem,
  NotificationsResponse,
  MarkReadResponse,
} from '@haseela/shared';
import { env } from '../config/env';
import { getSupabaseClient } from '../auth/supabase';
import { getSessionEpoch, getCurrentAuthUserId, enqueueAuthOp } from '../auth/authScope';
import { setAccountDeletionNotice, type AccountDeletionNotice } from '../auth/accountDeletionNotice';

export class ApiError extends Error {
  status: number;
  code?: string;
  responseBody?: string;

  constructor(status: number, message: string, code?: string, responseBody?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface FinancialSnapshot {
  clients: Client[];
  subscriptions: Subscription[];
  transactions: Transaction[];
}

let handlingExpiredSession = false;

/**
 * Recovers from an invalid/expired session on 401 by clearing the bad Supabase session locally.
 * Owner and epoch are frozen before any await and re-checked after every async boundary
 * (including inside the shared auth queue), so a late 401 can never sign out a newer session.
 * An optional `notice` is published for the login screen only when this call is the one that
 * actually performs the (still-current) local sign-out.
 */
export async function handleExpiredSession(
  expectedOwnerId?: string,
  expectedEpoch?: number,
  options?: { notice?: AccountDeletionNotice }
): Promise<void> {
  if (handlingExpiredSession) return;
  handlingExpiredSession = true;

  try {
    const scopeAtStart = getCurrentAuthUserId();
    const frozenOwner = expectedOwnerId ?? (typeof scopeAtStart === 'string' ? scopeAtStart : undefined);
    const frozenEpoch = expectedEpoch ?? getSessionEpoch();

    const stillCurrent = (): boolean => {
      if (frozenEpoch !== getSessionEpoch()) return false;
      const scope = getCurrentAuthUserId();
      if (scope === null) return false;
      if (frozenOwner !== undefined && scope !== undefined && scope !== frozenOwner) return false;
      return true;
    };

    if (!stillCurrent()) return;

    const client = getSupabaseClient();

    if (frozenOwner !== undefined) {
      let sdkUserId: string | undefined;
      let sdkFailed = false;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          sdkFailed = true;
        } else {
          sdkUserId = data?.session?.user?.id;
          // No session / no user: nothing left to sign out
          if (!sdkUserId) return;
        }
      } catch {
        sdkFailed = true;
      }
      // On an SDK error the user cannot be verified; the 401 plus the frozen scope/epoch decide.
      if (!sdkFailed && sdkUserId !== frozenOwner) return;
      if (!stillCurrent()) return;
    }

    await enqueueAuthOp(async () => {
      // The queue may have delayed us behind a sign-in/out: re-check before the destructive call
      if (!stillCurrent()) return;
      if (options?.notice) setAccountDeletionNotice(options.notice);
      await client.auth.signOut({ scope: 'local' });
    });
  } catch {
    // Best effort — local signOut should not throw
  } finally {
    handlingExpiredSession = false;
  }
}

function parseServerErrorMessage(
  body: string,
  status: number
): { message: string; code?: string } {
  if (!body) {
    return { message: `HTTP ${status}` };
  }

  try {
    const parsed = JSON.parse(body);

    if (Array.isArray(parsed.details) && parsed.details.length > 0) {
      const first = parsed.details[0];
      if (typeof first === 'string') return { message: first, code: parsed.code };
      if (first && typeof first.message === 'string') return { message: first.message, code: parsed.code };
    }

    if (parsed.message && typeof parsed.message === 'string') {
      return { message: parsed.message, code: parsed.code };
    }

    if (parsed.error && typeof parsed.error === 'string') {
      return { message: parsed.error, code: parsed.code };
    }

    if (parsed.details && typeof parsed.details === 'string') {
      return { message: parsed.details, code: parsed.code };
    }

    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      const first = parsed.errors[0];
      if (typeof first === 'string') return { message: first };
      if (first && typeof first.message === 'string') return { message: first.message };
    }
  } catch {
    // Not valid JSON — return truncated body or status fallback
    const trimmed = body.trim();
    if (trimmed.length > 0 && trimmed.length < 200) {
      return { message: trimmed };
    }
  }

  return { message: `HTTP ${status}` };
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  expectedOwnerId?: string;
  expectedEpoch?: number;
  /**
   * Called synchronously right before the HTTP request is dispatched. Everything that throws
   * before this point (no session, identity/epoch mismatch) provably never reached the server;
   * callers that must not guess whether a write happened (account deletion) rely on it.
   */
  onBeforeSend?: () => void;
}

/** The backend's 403 for any regular route once an account has a deletion record. */
const PENDING_DELETION_MESSAGE = /^account is pending deletion/i;

export async function apiRequest<T>(
  path: string,
  init?: ApiRequestOptions
): Promise<T> {
  const currentScope = getCurrentAuthUserId();

  // If module authScope explicitly marks signedOut (null), fail closed immediately
  if (currentScope === null) {
    throw new Error('Unauthenticated');
  }

  // 1. Freeze initiating epoch and owner BEFORE any asynchronous SDK awaits
  const preAwaitScope = currentScope;
  const initiatingEpoch = init?.expectedEpoch ?? getSessionEpoch();
  const initiatingOwnerId = init?.expectedOwnerId ?? (currentScope ?? undefined);

  // Destructure expectedOwnerId and expectedEpoch OUT so they never leak as fetch options
  const { expectedOwnerId, expectedEpoch, onBeforeSend, ...fetchInit } = init || {};

  // 2. Fetch session from Supabase SDK, failing closed on SDK error / missing session / missing token
  const client = getSupabaseClient();
  let sessionData: { session: any } | null = null;
  try {
    const res = await client.auth.getSession();
    if (res.error || !res.data?.session) {
      throw new Error('Unauthenticated');
    }
    sessionData = res.data;
  } catch (err) {
    throw err instanceof Error && err.message === 'Unauthenticated'
      ? err
      : new Error('Unauthenticated');
  }

  const token = sessionData.session?.access_token;
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Unauthenticated');
  }

  // Fail closed: the authoritative SDK user id is required, never a placeholder identity
  const rawOwnerId = sessionData.session?.user?.id;
  if (typeof rawOwnerId !== 'string' || !rawOwnerId.trim()) {
    throw new Error('Unauthenticated');
  }
  const sessionOwnerId = rawOwnerId.trim();

  // A transition from uninitialized to a published owner while getSession waits must not retarget old input
  if (preAwaitScope === undefined && getCurrentAuthUserId() !== undefined) {
    if (getCurrentAuthUserId() !== sessionOwnerId) {
      throw new Error('Identity verification failed');
    }
  }

  // If application auth scope is initialized, sessionOwnerId MUST match active scope
  const appAuthUser = getCurrentAuthUserId();
  if (appAuthUser !== undefined && appAuthUser !== null) {
    if (sessionOwnerId !== appAuthUser) {
      throw new Error('Identity verification failed');
    }
  }

  // 3. Preflight identity & epoch verification with opaque errors
  if (initiatingOwnerId !== undefined && sessionOwnerId && initiatingOwnerId !== sessionOwnerId) {
    throw new Error('Identity verification failed');
  }

  if (initiatingEpoch !== getSessionEpoch()) {
    throw new Error('Session state invalidated');
  }

  // Bind effective request owner to validated SDK user for all post-response/401 recovery
  const effectiveOwner = initiatingOwnerId ?? sessionOwnerId;

  const baseUrl = env.apiUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  // 4. Construct headers: case-insensitively filter caller Authorization, then freeze validated bearer
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fetchInit.headers) {
    if (typeof Headers !== 'undefined' && fetchInit.headers instanceof Headers) {
      fetchInit.headers.forEach((val, key) => {
        if (key.toLowerCase() !== 'authorization') {
          headers[key] = val;
        }
      });
    } else if (Array.isArray(fetchInit.headers)) {
      fetchInit.headers.forEach(([key, val]) => {
        if (key.toLowerCase() !== 'authorization') {
          headers[key] = val;
        }
      });
    } else if (typeof fetchInit.headers === 'object') {
      Object.entries(fetchInit.headers).forEach(([key, val]) => {
        if (key.toLowerCase() !== 'authorization' && val !== undefined) {
          headers[key] = String(val);
        }
      });
    }
  }

  headers['Authorization'] = `Bearer ${token}`;

  let body: BodyInit | null | undefined;
  if (
    typeof fetchInit?.body === 'string' ||
    (typeof FormData !== 'undefined' && fetchInit?.body instanceof FormData) ||
    (typeof Blob !== 'undefined' && fetchInit?.body instanceof Blob)
  ) {
    body = fetchInit.body as BodyInit;
  } else if (fetchInit?.body != null) {
    body = JSON.stringify(fetchInit.body);
  }

  onBeforeSend?.();
  const response = await fetch(url, {
    ...fetchInit,
    headers,
    body,
  });

  const checkFreshness = () => {
    const currentOwner = getCurrentAuthUserId();
    if (effectiveOwner !== undefined && currentOwner !== undefined && currentOwner !== effectiveOwner) {
      throw new Error('Identity verification failed');
    }
    if (initiatingEpoch !== getSessionEpoch()) {
      throw new Error('Session state invalidated');
    }
  };

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');

    // Recheck freshness before destructive session recovery!
    let isStale = false;
    try {
      checkFreshness();
    } catch {
      isStale = true;
    }

    if (response.status === 401 && !isStale) {
      await handleExpiredSession(effectiveOwner, initiatingEpoch);
    }
    const { message, code } = parseServerErrorMessage(responseBody, response.status);
    if (response.status === 403 && !isStale && PENDING_DELETION_MESSAGE.test(message)) {
      // The account is mid-deletion (e.g. the app was reopened): leave locally instead of
      // rendering broken screens. Fenced by the same owner/epoch as the request.
      await handleExpiredSession(effectiveOwner, initiatingEpoch, { notice: 'pending' });
    }
    throw new ApiError(response.status, message, code, responseBody);
  }

  if (response.status === 204) {
    checkFreshness();
    return null as unknown as T;
  }

  // Parse response body and recheck freshness AFTER parse
  const data = await response.json();
  checkFreshness();

  return data as Promise<T>;
}

export interface UserPreferences {
  name: string | null;
  email: string | null;
  currency: CurrencyCode;
  onboardedAt: string | null;
  notifyBillingReminders: boolean;
  notifyInvoiceDue: boolean;
  notifyWeeklySummary: boolean;
}

export type UpdateUserPreferencesInput = Partial<Pick<
  UserPreferences,
  'name' | 'currency' | 'onboardedAt' | 'notifyBillingReminders' | 'notifyInvoiceDue' | 'notifyWeeklySummary'
>>;

/**
 * Fetches the financial overview from the API.
 */
export async function loadFinancialSnapshot(): Promise<FinancialSnapshot> {
  return apiRequest<FinancialSnapshot>('/api/dashboard/overview');
}

/**
 * Fetches user preferences from GET /api/user/preferences.
 */
export async function fetchUserPreferences(options?: {
  expectedOwnerId?: string;
  expectedEpoch?: number;
}): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/api/user/preferences', options);
}

/**
 * Updates user preferences via PATCH /api/user/preferences.
 */
export async function updateUserPreferences(
  updates: UpdateUserPreferencesInput,
  options?: {
    expectedOwnerId?: string;
    expectedEpoch?: number;
  }
): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/api/user/preferences', {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Fetches notifications from GET /api/notifications.
 */
export async function fetchNotifications(options?: {
  expectedOwnerId?: string;
  expectedEpoch?: number;
}): Promise<NotificationsResponse> {
  return apiRequest<NotificationsResponse>('/api/notifications', options);
}

/**
 * Marks one notification (with id) or all notifications (without id) as read via POST /api/notifications/mark-read.
 */
export async function markNotificationsAsRead(
  id?: string,
  options?: {
    expectedOwnerId?: string;
    expectedEpoch?: number;
  }
): Promise<MarkReadResponse> {
  return apiRequest<MarkReadResponse>('/api/notifications/mark-read', {
    ...options,
    method: 'POST',
    body: JSON.stringify(id ? { id } : {}),
  });
}

/**
 * Creates a client via POST /api/clients/create.
 */
export async function createClient(
  client: Partial<Client>
): Promise<Client> {
  return apiRequest<Client>('/api/clients/create', {
    method: 'POST',
    body: JSON.stringify(client),
  });
}

/**
 * Creates a subscription via POST /api/subscriptions/create.
 */
export async function createSubscription(
  sub: Partial<Subscription>
): Promise<Subscription> {
  return apiRequest<Subscription>('/api/subscriptions/create', {
    method: 'POST',
    body: JSON.stringify(sub),
  });
}

/**
 * Creates a transaction via POST /api/transactions/create.
 */
export async function createTransaction(
  tx: Partial<Transaction>
): Promise<Transaction> {
  return apiRequest<Transaction>('/api/transactions/create', {
    method: 'POST',
    body: JSON.stringify(tx),
  });
}

/**
 * Updates an existing transaction via PUT /api/transactions/update/:id.
 */
export async function updateTransaction(
  id: string,
  tx: Partial<Transaction>
): Promise<Transaction> {
  return apiRequest<Transaction>(`/api/transactions/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tx),
  });
}

/**
 * Deletes a transaction via DELETE /api/transactions/delete/:id.
 */
export async function deleteTransaction(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/transactions/delete/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Creates a pending payment record via POST /api/transactions/pending.
 */
export async function createPendingPayment(
  data: Partial<Transaction>
): Promise<Transaction> {
  return apiRequest<Transaction>('/api/transactions/pending', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Updates a pending payment record via PATCH /api/transactions/pending/:id.
 */
export async function updatePendingPayment(
  id: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  return apiRequest<Transaction>(`/api/transactions/pending/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Deletes a pending payment record via DELETE /api/transactions/pending/:id.
 */
export async function deletePendingPayment(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/api/transactions/pending/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Completes a pending payment via POST /api/transactions/pending/:id/complete.
 */
export async function completePendingPayment(
  id: string,
  data?: { completedDate?: string } | string
): Promise<Transaction> {
  const body = typeof data === 'string' ? { completedDate: data } : data;
  return apiRequest<Transaction>(`/api/transactions/pending/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

/**
 * Reverts a completed transaction back to pending status.
 */
export async function revertPendingPayment(
  id: string,
  expectedDate?: string
): Promise<Transaction> {
  return apiRequest<Transaction>(`/api/transactions/pending/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({ expectedDate }),
  });
}
