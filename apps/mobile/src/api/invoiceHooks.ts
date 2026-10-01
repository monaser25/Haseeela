import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Invoice, Transaction } from '@haseela/shared';
import { useAuth } from '../auth';
import type { FinancialSnapshot } from './client';
import {
  fetchInvoicesApi,
  createInvoiceApi,
  updateInvoiceApi,
  deleteInvoiceApi,
  markInvoicePaidApi,
  sendInvoiceApi,
} from './invoicesApi';

export function useInvoices() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  return useQuery<Invoice[]>({
    queryKey: ['invoices', userId],
    queryFn: () => fetchInvoicesApi(),
    enabled: Boolean(userId),
  });
}

export function useInvoice(id: string) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useQuery<Invoice | null>({
    queryKey: ['invoices', userId, id],
    queryFn: async () => {
      const invoices = await fetchInvoicesApi();
      return invoices.find((inv) => inv.id === id) ?? null;
    },
    initialData: () => {
      const cached = queryClient.getQueryData<Invoice[]>(['invoices', userId]);
      return cached?.find((inv) => inv.id === id);
    },
    enabled: Boolean(userId && id),
  });
}

export function useCreateInvoice() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Invoice, Error, any>({
    mutationFn: (data) => createInvoiceApi(data),
    onSuccess: async (createdInvoice) => {
      queryClient.setQueryData<Invoice[]>(['invoices', userId], (old) => {
        if (!old) return [createdInvoice];
        return [createdInvoice, ...old.filter((i) => i.id !== createdInvoice.id)];
      });
      queryClient.setQueryData(['invoices', userId, createdInvoice.id], createdInvoice);
      await queryClient.invalidateQueries({ queryKey: ['invoices', userId] });
    },
  });
}

export function useUpdateInvoice() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<Invoice, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => updateInvoiceApi(id, data),
    onSuccess: async (updatedInvoice) => {
      queryClient.setQueryData<Invoice[]>(['invoices', userId], (old) => {
        if (!old) return [updatedInvoice];
        return old.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv));
      });
      queryClient.setQueryData(['invoices', userId, updatedInvoice.id], updatedInvoice);
      await queryClient.invalidateQueries({ queryKey: ['invoices', userId] });
    },
  });
}

export function useDeleteInvoice() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, string>({
    mutationFn: (id) => deleteInvoiceApi(id),
    onSuccess: async ({ id }) => {
      queryClient.setQueryData<Invoice[]>(['invoices', userId], (old) => {
        if (!old) return [];
        return old.filter((inv) => inv.id !== id);
      });
      queryClient.removeQueries({ queryKey: ['invoices', userId, id] });
      await queryClient.invalidateQueries({ queryKey: ['invoices', userId] });
    },
  });
}

export function useMarkInvoicePaid() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<
    { invoice: Invoice; transaction: Transaction | null },
    Error,
    string
  >({
    mutationFn: (id) => markInvoicePaidApi(id),
    onSuccess: async ({ invoice, transaction }) => {
      // 1. Immediately update invoice in query cache
      queryClient.setQueryData<Invoice[]>(['invoices', userId], (old) => {
        if (!old) return [invoice];
        return old.map((inv) => (inv.id === invoice.id ? invoice : inv));
      });
      queryClient.setQueryData(['invoices', userId, invoice.id], invoice);

      // 2. If a new transaction was created, upsert into overview transactions without duplicates
      if (transaction) {
        queryClient.setQueryData<FinancialSnapshot>(['overview', userId], (old) => {
          if (!old) return old;
          const exists = old.transactions.some((t) => t.id === transaction.id);
          const updatedTransactions = exists
            ? old.transactions.map((t) => (t.id === transaction.id ? transaction : t))
            : [transaction, ...old.transactions];
          return {
            ...old,
            transactions: updatedTransactions,
          };
        });
      }

      // 3. Await cache invalidations
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices', userId] }),
        queryClient.invalidateQueries({ queryKey: ['overview', userId] }),
        invoice.clientId
          ? queryClient.invalidateQueries({
              queryKey: ['client-transaction-count', userId, invoice.clientId],
            })
          : Promise.resolve(),
      ]);
    },
  });
}

export function useSendInvoice() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  return useMutation<
    { invoice: Invoice; attached: boolean; sentTo: string },
    Error,
    { id: string; to: string; message?: string }
  >({
    mutationFn: ({ id, to, message }) => sendInvoiceApi(id, { to, message }),
    onSuccess: async ({ invoice }) => {
      queryClient.setQueryData<Invoice[]>(['invoices', userId], (old) => {
        if (!old) return [invoice];
        return old.map((inv) => (inv.id === invoice.id ? invoice : inv));
      });
      queryClient.setQueryData(['invoices', userId, invoice.id], invoice);
      await queryClient.invalidateQueries({ queryKey: ['invoices', userId] });
    },
  });
}
