import { Client, Subscription, Transaction, Invoice } from '@/types/finance';
import { getDevAuthHeaders, isDevAuthEnabled } from '@/lib/devAuth';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

export type FinancialSnapshot = {
  clients: Client[];
  subscriptions: Subscription[];
  transactions: Transaction[];
};

const apiBaseUrl = () => {
  if (typeof window !== 'undefined') return '';

  const raw = process.env.NEXT_PUBLIC_API_URL || '';
  const value = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');

  if (!value || /localhost:4000|127\.0\.0\.1:4000/.test(value)) return '';

  return value;
};

class ApiRequestError extends Error {
  status?: number;
  responseBody?: string;
  serverMessage?: string;

  constructor(message: string, status?: number, responseBody?: string, serverMessage?: string) {
    super(message);
    this.status = status;
    this.responseBody = responseBody;
    this.serverMessage = serverMessage;
  }
}

// Guard so a burst of concurrent 401s only triggers one cleanup + redirect.
let handlingExpiredSession = false;

/**
 * Recover from an invalid/expired session: clear the bad Supabase token locally
 * and send the user to the login page. This prevents the app from getting stuck
 * showing "Financial data is unavailable" while holding a token the backend
 * rejects (e.g. it references a deleted-and-recreated Supabase user).
 */
const handleExpiredSession = async () => {
  if (typeof window === 'undefined' || handlingExpiredSession) return;
  handlingExpiredSession = true;

  try {
    if (!isDevAuthEnabled()) {
      await getSupabaseBrowserClient().auth.signOut({ scope: 'local' });
    }
  } catch {
    /* best effort — clearing the local session must not throw */
  }

  const path = window.location.pathname;
  if (!path.startsWith('/login') && !path.startsWith('/register')) {
    window.location.replace('/login?expired=1');
  }
};

const parseServerError = (body?: string) => {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.error === 'string') return parsed.error;
      if (Array.isArray(parsed.details) && parsed.details.length > 0) {
        const first = parsed.details[0];
        if (first && typeof first.message === 'string') return first.message;
      }
    }
  } catch {
    // Body wasn't JSON; fall through to undefined and use the default message.
  }
  return undefined;
};

const authHeaders = async () => {
  if (isDevAuthEnabled()) {
    const headers = getDevAuthHeaders();
    if (!headers) throw new Error('Missing local development session.');
    return headers;
  }

  const { data, error } = await getSupabaseBrowserClient().auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Missing authenticated Supabase session.');
  }

  return { Authorization: `Bearer ${data.session.access_token}` };
};

const logApiFailure = (method: string, url: string, err: unknown) => {
  if (err instanceof ApiRequestError) {
    console.error('Haseeela API request failed', {
      method,
      url,
      status: err.status,
      responseBody: err.responseBody,
    });
    return;
  }

  console.error('Haseeela API request failed', {
    method,
    url,
    error: err instanceof Error ? err.message : String(err),
  });
};

const userMessageForFailure = (resource: string, err: unknown) => {
  if (err instanceof ApiRequestError) {
    if (err.serverMessage) return err.serverMessage;
    if (err.status === 404) return `${resource[0].toUpperCase()}${resource.slice(1)} target was not found.`;
    if (err.status === 400) return `Unable to ${resource}. The server rejected the request as invalid.`;
    return `Unable to ${resource}. Server responded with ${err.status}.`;
  }

  if (err instanceof Error) {
    if (err.message.includes('Missing authenticated Supabase session') || err.message.includes('Invalid or expired session')) {
      return `Unable to ${resource}. Your session expired. Please log in again.`;
    }
    if (err.message.includes('Missing local development session')) {
      return `Unable to ${resource}. Sign in again to restore the local development session.`;
    }
    if (err.message.includes('Failed to fetch')) {
      return `Unable to ${resource}. Check that the API is reachable and try again.`;
    }
  }

  return `Unable to ${resource}. ${err instanceof Error ? err.message : 'Check that the API is reachable and try again.'}`;
};

const apiRequest = async <T>(path: string, options: RequestInit = {}, resource: string): Promise<T> => {
  const method = options.method || 'GET';
  const url = `${apiBaseUrl()}${path}`;

  try {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeaders()),
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => undefined);
      // A 401 means the session token is invalid/expired (e.g. it points at a
      // Supabase user that was deleted and re-created). Clear the bad session
      // and send the user to log in, instead of leaving them stuck on a
      // "Financial data is unavailable" screen with an unusable token.
      if (response.status === 401) await handleExpiredSession();
      throw new ApiRequestError(`HTTP ${response.status}`, response.status, responseBody, parseServerError(responseBody));
    }

    return response.json();
  } catch (err) {
    logApiFailure(method, url, err);
    throw new Error(userMessageForFailure(resource, err));
  }
};

export const loadFinancialSnapshot = async (): Promise<FinancialSnapshot> => {
  return apiRequest<FinancialSnapshot>('/api/dashboard/overview', {}, 'load financial data');
};

export const createClientAPI = async (client: Partial<Client>) => {
  return apiRequest<Client>('/api/clients/create', {
    method: 'POST',
    body: JSON.stringify(client),
  }, 'create client');
};

export const updateClientAPI = async (id: string, updates: Partial<Client>) => {
  return apiRequest<Client>(`/api/clients/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, 'update client');
};

export const deleteClientAPI = async (id: string) => {
  return apiRequest<Client>(`/api/clients/delete/${id}`, {
    method: 'DELETE',
  }, 'delete client');
};

export const deleteClientPermanentAPI = async (id: string) => {
  return apiRequest<{ id: string }>(`/api/clients/delete-permanent/${id}`, {
    method: 'DELETE',
  }, 'permanently delete client');
};

export const restoreClientAPI = async (id: string) => {
  return apiRequest<Client>(`/api/clients/restore/${id}`, {
    method: 'PATCH',
  }, 'restore client');
};

export const recordClientPaymentAPI = async (id: string) => {
  return apiRequest<{ client: Client; transaction: Transaction }>(`/api/clients/${id}/record-payment`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'record client payment');
};

export const createSubscriptionAPI = async (subscription: Partial<Subscription>) => {
  return apiRequest<Subscription>('/api/subscriptions/create', {
    method: 'POST',
    body: JSON.stringify(subscription),
  }, 'create subscription');
};

export const updateSubscriptionAPI = async (id: string, updates: Partial<Subscription>) => {
  return apiRequest<Subscription>(`/api/subscriptions/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, 'update subscription');
};

export const deleteSubscriptionAPI = async (id: string) => {
  return apiRequest<Subscription>(`/api/subscriptions/delete/${id}`, {
    method: 'DELETE',
  }, 'delete subscription');
};

export const restoreSubscriptionAPI = async (id: string) => {
  return apiRequest<Subscription>(`/api/subscriptions/restore/${id}`, {
    method: 'PATCH',
  }, 'restore subscription');
};

export const deleteSubscriptionPermanentAPI = async (id: string) => {
  return apiRequest<{ id: string }>(`/api/subscriptions/delete-permanent/${id}`, {
    method: 'DELETE',
  }, 'permanently delete subscription');
};

export const recordSubscriptionPaymentAPI = async (id: string) => {
  return apiRequest<{ subscription: Subscription; transaction: Transaction }>(`/api/subscriptions/${id}/record-payment`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'record subscription payment');
};

export const createTransactionAPI = async (transaction: Partial<Transaction>) => {
  return apiRequest<Transaction>('/api/transactions/create', {
    method: 'POST',
    body: JSON.stringify(transaction),
  }, 'create transaction');
};

export const updateTransactionAPI = async (id: string, updates: Partial<Transaction>) => {
  return apiRequest<Transaction>(`/api/transactions/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }, 'update transaction');
};

export const deleteTransactionAPI = async (id: string) => {
  return apiRequest<{ success: boolean }>(`/api/transactions/delete/${id}`, {
    method: 'DELETE',
  }, 'delete transaction');
};

export const createPendingPaymentAPI = async (data: { clientId: string; amount: number; expectedDate: string; note?: string }) => {
  return apiRequest<Transaction>('/api/transactions/pending', {
    method: 'POST',
    body: JSON.stringify(data),
  }, 'create pending payment');
};

export const updatePendingPaymentAPI = async (id: string, updates: { amount?: number; expectedDate?: string; note?: string }) => {
  return apiRequest<Transaction>(`/api/transactions/pending/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, 'update pending payment');
};

export const deletePendingPaymentAPI = async (id: string) => {
  return apiRequest<{ success: boolean }>(`/api/transactions/pending/${id}`, {
    method: 'DELETE',
  }, 'delete pending payment');
};

export const completePendingPaymentAPI = async (id: string, data: { completedDate?: string } = {}) => {
  return apiRequest<Transaction>(`/api/transactions/pending/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, 'complete pending payment');
};

export const revertPendingPaymentAPI = async (id: string) => {
  return apiRequest<Transaction>(`/api/transactions/pending/${id}/revert`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'revert pending payment');
};

export type InvoiceInput = {
  number?: string;
  clientId?: string | null;
  issueDate: string;
  dueDate: string;
  status?: string;
  currency: string;
  taxRate: number;
  discount: number;
  notes?: string;
  terms?: string;
  lineItems: { description: string; quantity: number; rate: number }[];
};

export const loadInvoicesAPI = async () => {
  return apiRequest<{ invoices: Invoice[] }>('/api/invoices', {}, 'load invoices');
};

export type ReportColumn = { key: string; label: string; numeric?: boolean };
export type ReportData = {
  type: string;
  title: string;
  range: { from: string; to: string };
  columns: ReportColumn[];
  rows: (string | number)[][];
  summary: { label: string; value: number; tone?: 'positive' | 'negative' | 'neutral' }[];
};

export const loadReportAPI = async (type: string, from: string, to: string) => {
  const qs = new URLSearchParams({ type, from, to, format: 'json' }).toString();
  return apiRequest<ReportData>(`/api/reports?${qs}`, {}, 'generate report');
};

export type UserPreferences = {
  name: string;
  email: string;
  currency: string;
  onboardedAt: string | null;
  notifyBillingReminders: boolean;
  notifyInvoiceDue: boolean;
  notifyWeeklySummary: boolean;
};

export const loadPreferencesAPI = async () => {
  return apiRequest<UserPreferences>('/api/user/preferences', {}, 'load preferences');
};

export const updatePreferencesAPI = async (updates: Partial<UserPreferences>) => {
  return apiRequest<UserPreferences>('/api/user/preferences', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, 'update preferences');
};

export const deleteAccountAPI = async () => {
  return apiRequest<{ ok: boolean }>('/api/user/delete', { method: 'DELETE' }, 'delete account');
};

// Prefer the RFC 5987 `filename*` (UTF-8, supports Arabic) when present,
// otherwise fall back to the plain ASCII `filename`.
const filenameFromDisposition = (disposition: string, fallback: string) => {
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through to the plain filename */
    }
  }
  const plain = disposition.match(/filename="?([^"]+)"?/i);
  return plain?.[1] || fallback;
};

export const downloadReportCsv = async (type: string, from: string, to: string) => {
  const qs = new URLSearchParams({ type, from, to, format: 'csv' }).toString();
  const url = `${apiBaseUrl()}/api/reports?${qs}`;
  const response = await fetch(url, {
    headers: { ...(await authHeaders()) },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Failed to export report (${response.status})`);
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  return { blob, filename: filenameFromDisposition(disposition, `${type}-report.csv`) };
};

export const downloadReportXlsx = async (type: string, from: string, to: string) => {
  const qs = new URLSearchParams({ type, from, to, format: 'xlsx' }).toString();
  const url = `${apiBaseUrl()}/api/reports?${qs}`;
  const response = await fetch(url, {
    headers: { ...(await authHeaders()) },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Failed to export report (${response.status})`);
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  return { blob, filename: filenameFromDisposition(disposition, `${type}-report.xlsx`) };
};

export const createInvoiceAPI = async (invoice: InvoiceInput) => {
  return apiRequest<Invoice>('/api/invoices/create', {
    method: 'POST',
    body: JSON.stringify(invoice),
  }, 'create invoice');
};

export const updateInvoiceAPI = async (id: string, invoice: InvoiceInput) => {
  return apiRequest<Invoice>(`/api/invoices/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(invoice),
  }, 'update invoice');
};

export const deleteInvoiceAPI = async (id: string) => {
  return apiRequest<{ id: string }>(`/api/invoices/delete/${id}`, {
    method: 'DELETE',
  }, 'delete invoice');
};

export const markInvoicePaidAPI = async (id: string) => {
  return apiRequest<{ invoice: Invoice; transaction: Transaction | null }>(`/api/invoices/${id}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'mark invoice paid');
};

export type SendInvoiceResult = { invoice: Invoice; attached: boolean; sentTo: string };

export class InvoiceSendError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'InvoiceSendError';
  }
}

// Dedicated request (not via apiRequest) so the structured { code } from the
// server survives — the UI needs `smtp_not_configured` to show the fallback.
export const sendInvoiceAPI = async (id: string, payload: { to: string; message?: string }): Promise<SendInvoiceResult> => {
  const url = `${apiBaseUrl()}/api/invoices/${id}/send`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    throw new InvoiceSendError(
      typeof data?.error === 'string' ? data.error : `Failed to send invoice (${response.status})`,
      response.status,
      typeof data?.code === 'string' ? data.code : undefined,
    );
  }
  return data as SendInvoiceResult;
};

export const downloadInvoicePdf = async (id: string) => {
  const url = `${apiBaseUrl()}/api/invoices/${id}/pdf`;
  const response = await fetch(url, {
    headers: { ...(await authHeaders()) },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Failed to download PDF (${response.status})`);
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob, filename: match?.[1] || `invoice-${id}.pdf` };
};
