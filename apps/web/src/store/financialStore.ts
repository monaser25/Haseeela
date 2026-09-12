import { create } from 'zustand';
import { Client, CurrencyCode, Subscription, Transaction } from '@/types/finance';
import { isCurrencyCode } from '@/lib/currency';
import {
  createClientAPI,
  updateClientAPI,
  deleteClientAPI,
  deleteClientPermanentAPI,
  restoreClientAPI,
  recordClientPaymentAPI,
  createSubscriptionAPI,
  updateSubscriptionAPI,
  deleteSubscriptionAPI,
  deleteSubscriptionPermanentAPI,
  restoreSubscriptionAPI,
  recordSubscriptionPaymentAPI,
  createTransactionAPI,
  updateTransactionAPI,
  deleteTransactionAPI,
  createPendingPaymentAPI,
  updatePendingPaymentAPI,
  deletePendingPaymentAPI,
  completePendingPaymentAPI,
  revertPendingPaymentAPI,
  loadFinancialSnapshot
} from '@/services/financialApi';
import { reconcileFinancialSnapshot, removeClientTransactions } from '@/services/financialSync';

const STORAGE_KEY = 'flowledger-financial-state';
const PREFERENCES_KEY = 'flowledger-preferences';

const getStorageKey = () => {
  const userId = useFinancialStore.getState().storageUserId;
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
};

const getPreferencesKey = (userId: string) => `${PREFERENCES_KEY}:${userId}`;

export const computeNextBillingDate = (billingDay: number, from = new Date()) => {
  const safeDay = Math.max(1, Math.min(28, billingDay || 1));
  const candidate = new Date(from.getFullYear(), from.getMonth(), safeDay, 12);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);

  if (candidate >= today) return candidate.toISOString().slice(0, 10);
  return new Date(from.getFullYear(), from.getMonth() + 1, safeDay, 12).toISOString().slice(0, 10);
};

interface FinancialStore {
  clients: Client[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  isInitialized: boolean;
  storageUserId: string | null;
  currency: CurrencyCode;
  error: string | null;

  setInitialData: (data: { clients: Client[]; subscriptions: Subscription[]; transactions: Transaction[] }) => void;
  initializeStore: (data: { clients: Client[]; subscriptions: Subscription[]; transactions: Transaction[] }) => void;
  setStorageUserId: (userId: string) => void;
  setCurrency: (currency: CurrencyCode) => void;
  resetStore: () => void;
  processPendingBillings: () => void;
  setError: (error: string | null) => void;

  addClient: (client: Client) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  deleteClientPermanently: (id: string) => Promise<void>;
  restoreClient: (id: string) => Promise<void>;
  recordClientPayment: (id: string) => Promise<void>;

  addSubscription: (subscription: Subscription) => Promise<void>;
  updateSubscription: (id: string, updates: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  deleteSubscriptionPermanently: (id: string) => Promise<void>;
  restoreSubscription: (id: string) => Promise<void>;
  recordSubscriptionPayment: (id: string) => Promise<void>;

  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addPendingPayment: (data: { clientId: string; amount: number; expectedDate: string; note?: string }) => Promise<void>;
  updatePendingPayment: (id: string, updates: { amount?: number; expectedDate?: string; note?: string }) => Promise<void>;
  deletePendingPayment: (id: string) => Promise<void>;
  completePendingPayment: (id: string, completedDate?: string) => Promise<void>;
  revertPendingPayment: (id: string) => Promise<void>;
  setTransactions: (transactions: Transaction[]) => void;
}

const persistLocalSnapshot = () => {
  if (typeof window === 'undefined') return;

  const { clients, subscriptions, transactions } = useFinancialStore.getState();
  window.localStorage.setItem(getStorageKey(), JSON.stringify({ clients, subscriptions, transactions }));
};

const persistPreferences = () => {
  if (typeof window === 'undefined') return;

  const { storageUserId, currency } = useFinancialStore.getState();
  if (!storageUserId) return;

  window.localStorage.setItem(getPreferencesKey(storageUserId), JSON.stringify({ currency }));
};

const loadCurrencyPreference = (userId: string): CurrencyCode => {
  if (typeof window === 'undefined') return 'USD';

  try {
    const cached = window.localStorage.getItem(getPreferencesKey(userId));
    if (!cached) return 'USD';
    const parsed = JSON.parse(cached);
    return isCurrencyCode(parsed.currency) ? parsed.currency : 'USD';
  } catch {
    return 'USD';
  }
};

const refreshDataFromAPI = async () => {
  try {
    const data = await loadFinancialSnapshot();
    useFinancialStore.getState().setInitialData(data);
    useFinancialStore.getState().setError(null);
    return data;
  } catch (err) {
    useFinancialStore.getState().setError('Failed to refresh data from server');
    throw err;
  }
};

const refreshAfterLocalMutation = async () => {
  try {
    await refreshDataFromAPI();
  } catch {
    // Keep the successful local mutation visible; the error banner tells the user sync refresh failed.
  }
};

export const useFinancialStore = create<FinancialStore>((set) => ({
  clients: [],
  subscriptions: [],
  transactions: [],
  isInitialized: false,
  storageUserId: null,
  currency: 'USD',
  error: null,

  setInitialData: (data) => {
    const normalized = reconcileFinancialSnapshot(data);
    set({
      clients: normalized.clients,
      subscriptions: normalized.subscriptions,
      transactions: normalized.transactions,
      isInitialized: true,
    });
    persistLocalSnapshot();
  },
  initializeStore: (data) => {
    useFinancialStore.getState().setInitialData(data);
  },
  setStorageUserId: (userId) => set({ storageUserId: userId, currency: loadCurrencyPreference(userId) }),
  setCurrency: (currency) => {
    set({ currency });
    persistPreferences();
  },
  resetStore: () => set({
    clients: [],
    subscriptions: [],
    transactions: [],
    isInitialized: false,
    storageUserId: null,
    currency: 'USD',
    error: null,
  }),
  setError: (error) => set({ error }),

  processPendingBillings: () => {
    // Deprecated for client-side calculation
  },

  addClient: async (client) => {
    try {
      const created = await createClientAPI(client);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: [created, ...state.clients.filter((item) => item.id !== created.id)],
          subscriptions: state.subscriptions,
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to create client' });
      throw e;
    }
  },
  updateClient: async (id, updates) => {
    try {
      const updated = await updateClientAPI(id, updates);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients.map((client) => (client.id === id ? updated : client)),
          subscriptions: state.subscriptions,
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update client' });
      throw e;
    }
  },
  deleteClient: async (id) => {
    try {
      const archived = await deleteClientAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients.map((client) => (client.id === id ? archived : client)),
          subscriptions: state.subscriptions,
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to delete client' });
      throw e;
    }
  },
  deleteClientPermanently: async (id) => {
    try {
      await deleteClientPermanentAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients.filter((client) => client.id !== id),
          subscriptions: state.subscriptions,
          transactions: removeClientTransactions(state.transactions, id),
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to permanently delete client' });
      throw e;
    }
  },
  restoreClient: async (id) => {
    try {
      const restored = await restoreClientAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients.map((client) => (client.id === id ? restored : client)),
          subscriptions: state.subscriptions,
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to restore client' });
      throw e;
    }
  },
  recordClientPayment: async (id) => {
    try {
      const { client, transaction } = await recordClientPaymentAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients.map((item) => (item.id === id ? client : item)),
          subscriptions: state.subscriptions,
          transactions: [transaction, ...state.transactions.filter((item) => item.id !== transaction.id)],
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to record client payment' });
      throw e;
    }
  },

  addSubscription: async (sub) => {
    try {
      const created = await createSubscriptionAPI(sub);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients,
          subscriptions: [created, ...state.subscriptions.filter((item) => item.id !== created.id)],
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to add subscription' });
      throw e;
    }
  },
  updateSubscription: async (id, updates) => {
    try {
      const updated = await updateSubscriptionAPI(id, updates);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients,
          subscriptions: state.subscriptions.map((sub) => (sub.id === id ? updated : sub)),
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update subscription' });
      throw e;
    }
  },
  deleteSubscription: async (id) => {
    try {
      const archived = await deleteSubscriptionAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients,
          subscriptions: state.subscriptions.map((sub) => (sub.id === id ? archived : sub)),
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to delete subscription' });
      throw e;
    }
  },
  deleteSubscriptionPermanently: async (id) => {
    try {
      await deleteSubscriptionPermanentAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients,
          subscriptions: state.subscriptions.filter((sub) => sub.id !== id),
          transactions: state.transactions.filter(
            (tx) => !(tx.subscriptionId === id || (tx.sourceType === 'subscription' && tx.sourceId === id)),
          ),
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to permanently delete subscription' });
      throw e;
    }
  },
  restoreSubscription: async (id) => {
    try {
      const restored = await restoreSubscriptionAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients,
          subscriptions: state.subscriptions.map((sub) => (sub.id === id ? restored : sub)),
          transactions: state.transactions,
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to restore subscription' });
      throw e;
    }
  },
  recordSubscriptionPayment: async (id) => {
    try {
      const { subscription, transaction } = await recordSubscriptionPaymentAPI(id);
      set((state) => ({
        ...reconcileFinancialSnapshot({
          clients: state.clients,
          subscriptions: state.subscriptions.map((item) => (item.id === id ? subscription : item)),
          transactions: [transaction, ...state.transactions.filter((item) => item.id !== transaction.id)],
        }),
        error: null,
      }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to record subscription payment' });
      throw e;
    }
  },

  addTransaction: async (tx) => {
    try {
      const created = await createTransactionAPI({ ...tx, isAuto: false, sourceType: 'manual' });
      set((state) => ({ transactions: [created, ...state.transactions.filter((item) => item.id !== created.id)], error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to create transaction' });
      throw e;
    }
  },
  updateTransaction: async (id, updates) => {
    try {
      const updated = await updateTransactionAPI(id, updates);
      set((state) => ({ transactions: state.transactions.map((tx) => (tx.id === id ? updated : tx)), error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update transaction' });
      throw e;
    }
  },
  deleteTransaction: async (id) => {
    try {
      await deleteTransactionAPI(id);
      set((state) => ({ transactions: state.transactions.filter((tx) => tx.id !== id), error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to delete transaction' });
      throw e;
    }
  },
  addPendingPayment: async (data) => {
    try {
      const created = await createPendingPaymentAPI(data);
      set((state) => ({ transactions: [created, ...state.transactions.filter((item) => item.id !== created.id)], error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to create pending payment' });
      throw e;
    }
  },
  updatePendingPayment: async (id, updates) => {
    try {
      const updated = await updatePendingPaymentAPI(id, updates);
      set((state) => ({ transactions: state.transactions.map((tx) => (tx.id === id ? updated : tx)), error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update pending payment' });
      throw e;
    }
  },
  deletePendingPayment: async (id) => {
    try {
      await deletePendingPaymentAPI(id);
      set((state) => ({ transactions: state.transactions.filter((tx) => tx.id !== id), error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to delete pending payment' });
      throw e;
    }
  },
  completePendingPayment: async (id, completedDate) => {
    try {
      const updated = await completePendingPaymentAPI(id, { completedDate });
      set((state) => ({ transactions: state.transactions.map((tx) => (tx.id === id ? updated : tx)), error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to complete pending payment' });
      throw e;
    }
  },
  revertPendingPayment: async (id) => {
    try {
      const updated = await revertPendingPaymentAPI(id);
      set((state) => ({ transactions: state.transactions.map((tx) => (tx.id === id ? updated : tx)), error: null }));
      persistLocalSnapshot();
      await refreshAfterLocalMutation();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to revert pending payment' });
      throw e;
    }
  },
  setTransactions: (transactions) => {
    const { clients, subscriptions } = useFinancialStore.getState();
    set(reconcileFinancialSnapshot({ clients, subscriptions, transactions }));
    persistLocalSnapshot();
  }
}));
