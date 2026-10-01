import { useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, onlineManager, type MutateOptions } from '@tanstack/react-query';
import type {
  Client,
  Subscription,
  Transaction,
  NotificationsResponse,
  MarkReadResponse,
} from '@haseela/shared';
import { useAuth } from '../auth';
import { getSessionEpoch, getCurrentAuthUserId } from '../auth/authScope';
import {
  loadFinancialSnapshot,
  fetchUserPreferences,
  updateUserPreferences,
  fetchNotifications,
  markNotificationsAsRead,
  createClient,
  createSubscription,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createPendingPayment,
  updatePendingPayment,
  deletePendingPayment,
  completePendingPayment,
  revertPendingPayment,
  FinancialSnapshot,
  UserPreferences,
  UpdateUserPreferencesInput,
} from './client';
import {
  updateClientApi,
  archiveClientApi,
  restoreClientApi,
  deleteClientPermanentApi,
  fetchClientTransactionCount,
  recordClientPaymentApi,
} from './clientsApi';
import {
  updateSubscriptionApi,
  archiveSubscriptionApi,
  restoreSubscriptionApi,
  deleteSubscriptionPermanentApi,
  recordSubscriptionPaymentApi,
} from './subscriptionsApi';

function invalidateOverview(queryClient: ReturnType<typeof useQueryClient>, userId: string, clientId?: string) {
  queryClient.invalidateQueries({ queryKey: ['overview', userId] });
  if (clientId) {
    queryClient.invalidateQueries({ queryKey: ['client-transaction-count', userId, clientId] });
  }
}

export function useOverview() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<FinancialSnapshot>({
    queryKey: ['overview', userId],
    queryFn: () => loadFinancialSnapshot(),
    enabled: Boolean(userId),
  });
}

export function usePreferences() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<UserPreferences>({
    queryKey: ['preferences', userId],
    queryFn: () => {
      const epoch = getSessionEpoch();
      return fetchUserPreferences({
        expectedOwnerId: userId,
        expectedEpoch: epoch,
      });
    },
    enabled: Boolean(userId),
  });
}

interface ScopedPayload<T> {
  payload: T;
  scope: {
    ownerId?: string;
    epoch: number;
  };
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const currentUserId = getCurrentAuthUserId();
  const currentEpoch = getSessionEpoch();
  const inFlightScopeRef = useRef<{ ownerId?: string; epoch: number } | null>(null);

  const mutation = useMutation<
    UserPreferences,
    Error,
    ScopedPayload<UpdateUserPreferencesInput>
  >({
    networkMode: 'always',
    mutationFn: async ({ payload, scope }) => {
      if (!onlineManager.isOnline()) {
        throw new Error('Offline: Server preferences cannot be updated while offline');
      }
      return updateUserPreferences(payload, {
        expectedOwnerId: scope.ownerId,
        expectedEpoch: scope.epoch,
      });
    },
    onSuccess: async (updated, variables) => {
      const { scope } = variables;
      const currentOwner = getCurrentAuthUserId();
      const epochNow = getSessionEpoch();

      if (
        !scope.ownerId ||
        scope.epoch !== epochNow ||
        (currentOwner !== undefined && currentOwner !== scope.ownerId)
      ) {
        return;
      }

      queryClient.setQueryData(['preferences', scope.ownerId], updated);
      await queryClient.invalidateQueries({ queryKey: ['preferences', scope.ownerId] });
    },
    onSettled: () => {
      inFlightScopeRef.current = null;
    },
  });

  const isOwnerPending = Boolean(
    mutation.isPending &&
      inFlightScopeRef.current &&
      inFlightScopeRef.current.epoch === currentEpoch &&
      (currentUserId === undefined || inFlightScopeRef.current.ownerId === currentUserId)
  );

  return useMemo(() => {
    return {
      ...mutation,
      isPending: isOwnerPending,
      mutate: (
        variables: UpdateUserPreferencesInput,
        options?: MutateOptions<UserPreferences, Error, UpdateUserPreferencesInput, unknown>
      ) => {
        const scope = {
          ownerId: (getCurrentAuthUserId() ?? undefined) as string | undefined,
          epoch: getSessionEpoch(),
        };
        inFlightScopeRef.current = scope;

        return mutation.mutate(
          { payload: variables, scope },
          {
            onSuccess: (data) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSuccess?.(data, variables, undefined);
              }
            },
            onError: (err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onError?.(err, variables, undefined);
              }
            },
            onSettled: (data, err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSettled?.(data, err, variables, undefined);
              }
            },
          }
        );
      },
      mutateAsync: async (
        variables: UpdateUserPreferencesInput,
        options?: MutateOptions<UserPreferences, Error, UpdateUserPreferencesInput, unknown>
      ): Promise<UserPreferences> => {
        const scope = {
          ownerId: (getCurrentAuthUserId() ?? undefined) as string | undefined,
          epoch: getSessionEpoch(),
        };
        inFlightScopeRef.current = scope;

        const data = await mutation.mutateAsync(
          { payload: variables, scope },
          {
            onSuccess: (res) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSuccess?.(res, variables, undefined);
              }
            },
            onError: (err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onError?.(err, variables, undefined);
              }
            },
            onSettled: (res, err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSettled?.(res, err, variables, undefined);
              }
            },
          }
        );

        if (
          scope.epoch !== getSessionEpoch() ||
          (getCurrentAuthUserId() !== undefined && getCurrentAuthUserId() !== scope.ownerId)
        ) {
          throw new Error('Identity verification failed');
        }

        return data;
      },
    };
  }, [mutation, isOwnerPending]);
}

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', userId],
    queryFn: () => {
      const epoch = getSessionEpoch();
      return fetchNotifications({
        expectedOwnerId: userId,
        expectedEpoch: epoch,
      });
    },
    enabled: Boolean(userId),
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const currentUserId = getCurrentAuthUserId();
  const currentEpoch = getSessionEpoch();
  const inFlightScopeRef = useRef<{ ownerId?: string; epoch: number } | null>(null);

  const mutation = useMutation<
    MarkReadResponse,
    Error,
    ScopedPayload<string | undefined>
  >({
    networkMode: 'always',
    mutationFn: async ({ payload: id, scope }) => {
      if (!onlineManager.isOnline()) {
        throw new Error('Offline: Cannot mark notifications as read while offline');
      }
      return markNotificationsAsRead(id, {
        expectedOwnerId: scope.ownerId,
        expectedEpoch: scope.epoch,
      });
    },
    onSuccess: async (data, variables) => {
      const { payload: id, scope } = variables;
      const currentOwner = getCurrentAuthUserId();
      const epochNow = getSessionEpoch();

      if (
        !scope.ownerId ||
        scope.epoch !== epochNow ||
        (currentOwner !== undefined && currentOwner !== scope.ownerId)
      ) {
        return;
      }

      queryClient.setQueryData<NotificationsResponse>(['notifications', scope.ownerId], (old) => {
        if (!old) return old;
        if (id) {
          return {
            unread: data.unread,
            notifications: old.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          };
        }
        return {
          unread: data.unread,
          notifications: old.notifications.map((n) => ({ ...n, read: true })),
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['notifications', scope.ownerId] });
    },
    onSettled: () => {
      inFlightScopeRef.current = null;
    },
  });

  const isOwnerPending = Boolean(
    mutation.isPending &&
      inFlightScopeRef.current &&
      inFlightScopeRef.current.epoch === currentEpoch &&
      (currentUserId === undefined || inFlightScopeRef.current.ownerId === currentUserId)
  );

  return useMemo(() => {
    return {
      ...mutation,
      isPending: isOwnerPending,
      mutate: (
        id?: string,
        options?: MutateOptions<MarkReadResponse, Error, string | undefined, unknown>
      ) => {
        const scope = {
          ownerId: (getCurrentAuthUserId() ?? undefined) as string | undefined,
          epoch: getSessionEpoch(),
        };
        inFlightScopeRef.current = scope;

        return mutation.mutate(
          { payload: id, scope },
          {
            onSuccess: (data) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSuccess?.(data, id, undefined);
              }
            },
            onError: (err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onError?.(err, id, undefined);
              }
            },
            onSettled: (data, err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSettled?.(data, err, id, undefined);
              }
            },
          }
        );
      },
      mutateAsync: async (
        id?: string,
        options?: MutateOptions<MarkReadResponse, Error, string | undefined, unknown>
      ): Promise<MarkReadResponse> => {
        const scope = {
          ownerId: (getCurrentAuthUserId() ?? undefined) as string | undefined,
          epoch: getSessionEpoch(),
        };
        inFlightScopeRef.current = scope;

        const data = await mutation.mutateAsync(
          { payload: id, scope },
          {
            onSuccess: (res) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSuccess?.(res, id, undefined);
              }
            },
            onError: (err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onError?.(err, id, undefined);
              }
            },
            onSettled: (res, err) => {
              if (
                scope.epoch === getSessionEpoch() &&
                (getCurrentAuthUserId() === undefined || getCurrentAuthUserId() === scope.ownerId)
              ) {
                (options as any)?.onSettled?.(res, err, id, undefined);
              }
            },
          }
        );

        if (
          scope.epoch !== getSessionEpoch() ||
          (getCurrentAuthUserId() !== undefined && getCurrentAuthUserId() !== scope.ownerId)
        ) {
          throw new Error('Identity verification failed');
        }

        return data;
      },
    };
  }, [mutation, isOwnerPending]);
}

export function useCreateClient() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Client, Error, Partial<Client>>({
    mutationFn: (client) => createClient(client),
    onSuccess: () => {
      invalidateOverview(queryClient, userId);
    },
  });
}

export function useCreateSubscription() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, Partial<Subscription>>({
    mutationFn: (sub) => createSubscription(sub),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, Partial<Transaction>>({
    mutationFn: (tx) => createTransaction(tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useUpdateTransaction() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, { id: string; updates: Partial<Transaction> }>({
    mutationFn: ({ id, updates }) => updateTransaction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useDeleteTransaction() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useCreatePendingPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<
    Transaction,
    Error,
    { clientId: string; amount: number; expectedDate: string; note?: string }
  >({
    mutationFn: (data) => createPendingPayment(data),
    onSuccess: (_, vars) => {
      invalidateOverview(queryClient, userId, vars.clientId);
    },
  });
}

export function useUpdatePendingPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<
    Transaction,
    Error,
    { id: string; updates: { amount?: number; expectedDate?: string; note?: string } }
  >({
    mutationFn: ({ id, updates }) => updatePendingPayment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useDeletePendingPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => deletePendingPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useCompletePendingPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, { id: string; data?: { completedDate?: string } }>({
    mutationFn: ({ id, data }) => completePendingPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useRevertPendingPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, string>({
    mutationFn: (id) => revertPendingPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useClientTransactionCount(clientId: string, enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<{ count: number }>({
    queryKey: ['client-transaction-count', userId, clientId],
    queryFn: () => fetchClientTransactionCount(clientId),
    enabled: Boolean(userId && clientId && enabled),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useUpdateClient() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Client, Error, { id: string; updates: Partial<Client> }>({
    mutationFn: ({ id, updates }) => updateClientApi(id, updates),
    onSuccess: (_, { id }) => {
      invalidateOverview(queryClient, userId, id);
    },
  });
}

export function useArchiveClient() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Client, Error, string>({
    mutationFn: (id) => archiveClientApi(id),
    onSuccess: (_, id) => {
      invalidateOverview(queryClient, userId, id);
    },
  });
}

export function useRestoreClient() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Client, Error, string>({
    mutationFn: (id) => restoreClientApi(id),
    onSuccess: (_, id) => {
      invalidateOverview(queryClient, userId, id);
    },
  });
}

export function useDeleteClientPermanent() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, string>({
    mutationFn: (id) => deleteClientPermanentApi(id),
    onSuccess: (_, id) => {
      invalidateOverview(queryClient, userId, id);
    },
  });
}

export function useRecordClientPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<{ client: Client; transaction: Transaction }, Error, { id: string; today?: string }>({
    mutationFn: ({ id, today }) => recordClientPaymentApi(id, today),
    onSuccess: (_, { id }) => {
      invalidateOverview(queryClient, userId, id);
    },
  });
}

export function useUpdateSubscription() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, { id: string; updates: Partial<Subscription> }>({
    mutationFn: ({ id, updates }) => updateSubscriptionApi(id, updates),
    onSuccess: async (updated) => {
      queryClient.setQueryData<FinancialSnapshot>(['overview', userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          subscriptions: old.subscriptions.map((s) => (s.id === updated.id ? updated : s)),
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useArchiveSubscription() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, string>({
    mutationFn: (id) => archiveSubscriptionApi(id),
    onSuccess: async (archived) => {
      queryClient.setQueryData<FinancialSnapshot>(['overview', userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          subscriptions: old.subscriptions.map((s) => (s.id === archived.id ? archived : s)),
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useRestoreSubscription() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Subscription, Error, string>({
    mutationFn: (id) => restoreSubscriptionApi(id),
    onSuccess: async (restored) => {
      queryClient.setQueryData<FinancialSnapshot>(['overview', userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          subscriptions: old.subscriptions.map((s) => (s.id === restored.id ? restored : s)),
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useDeleteSubscriptionPermanent() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, string>({
    mutationFn: (id) => deleteSubscriptionPermanentApi(id),
    onSuccess: async ({ id }) => {
      queryClient.setQueryData<FinancialSnapshot>(['overview', userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          subscriptions: old.subscriptions.filter((s) => s.id !== id),
          transactions: old.transactions.filter(
            (tx) => tx.subscriptionId !== id && !(tx.sourceType === 'subscription' && tx.sourceId === id)
          ),
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

export function useRecordSubscriptionPayment() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<
    { subscription: Subscription; transaction: Transaction },
    Error,
    { id: string; today?: string }
  >({
    mutationFn: ({ id, today }) => recordSubscriptionPaymentApi(id, today),
    onSuccess: async ({ subscription, transaction }) => {
      queryClient.setQueryData<FinancialSnapshot>(['overview', userId], (old) => {
        if (!old) return old;
        const exists = old.transactions.some((t) => t.id === transaction.id);
        const updatedTransactions = exists
          ? old.transactions.map((t) => (t.id === transaction.id ? transaction : t))
          : [transaction, ...old.transactions];
        return {
          ...old,
          subscriptions: old.subscriptions.map((s) => (s.id === subscription.id ? subscription : s)),
          transactions: updatedTransactions,
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['overview', userId] });
    },
  });
}

