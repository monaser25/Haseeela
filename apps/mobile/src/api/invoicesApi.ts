import type { Invoice, Transaction } from '@haseela/shared';
import { apiRequest } from './client';

export * from '../services/pdf/invoicePdfService';

/**
 * Fetches all invoices owned by the current user.
 * GET /api/invoices
 */
export async function fetchInvoicesApi(): Promise<Invoice[]> {
  const data = await apiRequest<{ invoices: Invoice[] }>('/api/invoices');
  return data.invoices;
}

/**
 * Creates a new invoice in DRAFT status.
 * POST /api/invoices/create
 */
export async function createInvoiceApi(payload: unknown): Promise<Invoice> {
  return apiRequest<Invoice>('/api/invoices/create', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Updates an existing invoice.
 * PUT /api/invoices/update/{id}
 */
export async function updateInvoiceApi(id: string, payload: unknown): Promise<Invoice> {
  return apiRequest<Invoice>(`/api/invoices/update/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

/**
 * Deletes an invoice permanently.
 * DELETE /api/invoices/delete/{id}
 */
export async function deleteInvoiceApi(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/api/invoices/delete/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Marks an invoice as PAID, atomically generating an INCOME transaction if not already paid.
 * POST /api/invoices/{id}/mark-paid
 */
export async function markInvoicePaidApi(
  id: string
): Promise<{ invoice: Invoice; transaction: Transaction | null }> {
  return apiRequest<{ invoice: Invoice; transaction: Transaction | null }>(
    `/api/invoices/${id}/mark-paid`,
    {
      method: 'POST',
      body: {},
    }
  );
}

/**
 * Sends an invoice via email.
 * POST /api/invoices/{id}/send
 */
export async function sendInvoiceApi(
  id: string,
  payload: { to: string; message?: string }
): Promise<{ invoice: Invoice; attached: boolean; sentTo: string }> {
  return apiRequest<{ invoice: Invoice; attached: boolean; sentTo: string }>(
    `/api/invoices/${id}/send`,
    {
      method: 'POST',
      body: payload,
    }
  );
}
