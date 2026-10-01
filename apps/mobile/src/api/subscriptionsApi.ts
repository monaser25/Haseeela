import type { Subscription, Transaction } from '@haseela/shared';
import { apiRequest } from './client';

/**
 * Updates a subscription.
 * PUT /api/subscriptions/update/{id}
 */
export async function updateSubscriptionApi(
  id: string,
  updates: Partial<Subscription>
): Promise<Subscription> {
  return apiRequest<Subscription>(`/api/subscriptions/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Archives a subscription by marking it INACTIVE and setting archivedAt.
 * DELETE /api/subscriptions/delete/{id}
 */
export async function archiveSubscriptionApi(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(`/api/subscriptions/delete/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Restores an archived subscription back to ACTIVE with archivedAt: null.
 * PATCH /api/subscriptions/restore/{id}
 */
export async function restoreSubscriptionApi(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(`/api/subscriptions/restore/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

/**
 * Permanently deletes an archived subscription and its linked transactions atomically.
 * DELETE /api/subscriptions/delete-permanent/{id}
 */
export async function deleteSubscriptionPermanentApi(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/api/subscriptions/delete-permanent/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Records a recurring payment for an active subscription.
 * Advances nextBillingDate according to the subscription's billing cycle.
 * POST /api/subscriptions/{id}/record-payment
 */
export async function recordSubscriptionPaymentApi(
  id: string,
  today?: string
): Promise<{ subscription: Subscription; transaction: Transaction }> {
  return apiRequest<{ subscription: Subscription; transaction: Transaction }>(
    `/api/subscriptions/${id}/record-payment`,
    {
      method: 'POST',
      body: JSON.stringify(today ? { today } : {}),
    }
  );
}
