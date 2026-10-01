import type { Client, Transaction } from '@haseela/shared';
import { apiRequest } from './client';

/**
 * Updates a client.
 * PUT /api/clients/update/{id}
 */
export async function updateClientApi(id: string, updates: Partial<Client>): Promise<Client> {
  return apiRequest<Client>(`/api/clients/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Archives a client by marking it INACTIVE and setting archivedAt.
 * DELETE /api/clients/delete/{id}
 */
export async function archiveClientApi(id: string): Promise<Client> {
  return apiRequest<Client>(`/api/clients/delete/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Restores an archived client back to ACTIVE with archivedAt: null.
 * PATCH /api/clients/restore/{id}
 */
export async function restoreClientApi(id: string): Promise<Client> {
  return apiRequest<Client>(`/api/clients/restore/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

/**
 * Permanently deletes an archived client and its linked transactions.
 * DELETE /api/clients/delete-permanent/{id}
 */
export async function deleteClientPermanentApi(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/api/clients/delete-permanent/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Fetches the count of non-deleted transactions linked to this client.
 * GET /api/clients/{id}/transaction-count
 */
export async function fetchClientTransactionCount(id: string): Promise<{ count: number }> {
  return apiRequest<{ count: number }>(`/api/clients/${id}/transaction-count`);
}

/**
 * Records a recurring monthly payment for an active retainer client.
 * Advances the nextBillingDate by one month and creates an income transaction.
 * POST /api/clients/{id}/record-payment
 */
export async function recordClientPaymentApi(
  id: string,
  today?: string
): Promise<{ client: Client; transaction: Transaction }> {
  return apiRequest<{ client: Client; transaction: Transaction }>(`/api/clients/${id}/record-payment`, {
    method: 'POST',
    body: JSON.stringify(today ? { today } : {}),
  });
}

