import type { Client, Subscription, Transaction, NotificationItem } from '@haseela/shared';
import type { UserPreferences } from '../api/client';

export interface RecordedRequest {
  method: string;
  url: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface MockServerState {
  transactions: Transaction[];
  clients: Client[];
  subscriptions: Subscription[];
  preferences: UserPreferences;
  notifications: NotificationItem[];
}

export const defaultMockNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'BILLING_DUE',
    title: 'Linear Plus bills tomorrow',
    body: '$8 monthly subscription',
    link: '/subscriptions',
    read: false,
    refKey: 'billing:sub-linear:2026-05-15',
    userId: 'usr-1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    type: 'INVOICE_OVERDUE',
    title: 'Invoice #0044 is overdue',
    body: 'Marcus Wright · 4 days late · $1,850',
    link: '/invoices/inv-0044',
    read: false,
    refKey: 'invoice:inv-0044:overdue',
    userId: 'usr-1',
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
  },
  {
    id: 'notif-3',
    type: 'PAYMENT_RECORDED',
    title: 'Payment received',
    body: 'Northwind Studios · +$2,400',
    link: '/clients',
    read: true,
    refKey: 'payment:tx-100',
    userId: 'usr-1',
    createdAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
];

export const defaultMockPreferences: UserPreferences = {
  name: 'Test User',
  email: 'test@example.com',
  currency: 'USD',
  onboardedAt: '2026-01-01T00:00:00.000Z',
  notifyBillingReminders: true,
  notifyInvoiceDue: true,
  notifyWeeklySummary: true,
};

export const defaultMockClients: Client[] = [
  {
    id: 'client-1',
    name: 'Acme Corp',
    revenue: 5000,
    clientType: 'INDIVIDUAL',
    status: 'ACTIVE',
    paymentType: 'onetime',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'client-2',
    name: 'Globex Corp',
    revenue: 3000,
    clientType: 'INDIVIDUAL',
    status: 'ACTIVE',
    paymentType: 'onetime',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const defaultMockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    name: 'Website Redesign',
    amount: 3500,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2026-03-20T10:00:00.000Z',
    sourceType: 'manual',
    categoryId: 'CLIENT',
  },
  {
    id: 'tx-2',
    name: 'Figma Subscription',
    amount: 15,
    type: 'EXPENSE',
    status: 'COMPLETED',
    date: '2026-03-19T10:00:00.000Z',
    sourceType: 'subscription',
    categoryId: 'TOOLS',
    isAuto: true,
  },
  {
    id: 'tx-3',
    name: 'App Milestone 1',
    amount: 2000,
    type: 'INCOME',
    status: 'PENDING',
    date: '2026-03-10T10:00:00.000Z',
    expectedDate: '2026-03-10T10:00:00.000Z',
    sourceType: 'client',
    categoryId: 'CLIENT',
    clientId: 'client-1',
  },
  {
    id: 'tx-4',
    name: 'Brand Strategy',
    amount: 1800,
    type: 'INCOME',
    status: 'COMPLETED',
    date: '2026-03-18T10:00:00.000Z',
    expectedDate: '2026-03-15T10:00:00.000Z',
    sourceType: 'client',
    categoryId: 'CLIENT',
  },
];

export function createMockResponse(status: number, data: any, headers?: Record<string, string>): Response {
  const isOk = status >= 200 && status < 300;
  const isBinary = data instanceof Uint8Array || data instanceof ArrayBuffer;
  const textBody = isBinary
    ? ''
    : typeof data === 'string'
      ? data
      : data === undefined
        ? ''
        : JSON.stringify(data);
  const responseHeaders = new Headers(headers || {});
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', isBinary ? 'application/pdf' : 'application/json');
  }
  return {
    ok: isOk,
    status,
    statusText: isOk ? 'OK' : 'Error',
    headers: responseHeaders,
    text: async () => textBody,
    json: async () => {
      if (isBinary) {
        return data;
      }
      if (data === undefined) {
        return undefined;
      }
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return JSON.parse(textBody);
    },
    arrayBuffer: async () => {
      if (data instanceof ArrayBuffer) return data;
      if (data instanceof Uint8Array) return data.buffer;
      return new TextEncoder().encode(textBody).buffer;
    },
  } as unknown as Response;
}

export type CustomRouteHandler = (
  method: string,
  path: string,
  body: any,
  request: RecordedRequest,
  server: MockHttpServer
) => Promise<Response | null | undefined> | Response | null | undefined;

export class MockHttpServer {
  private state: MockServerState = {
    transactions: [...defaultMockTransactions],
    clients: [...defaultMockClients],
    subscriptions: [],
    preferences: { ...defaultMockPreferences },
    notifications: [...defaultMockNotifications],
  };

  private requests: RecordedRequest[] = [];
  private errorOverrides: Map<string, { status: number; body: any; once?: boolean }> = new Map();
  private pendingRoutes: Set<string> = new Set();
  private pendingResolvers: Map<string, Array<{ resolve: (res: Response) => void; reject: (err: any) => void }>> =
    new Map();

  private customHandlers: CustomRouteHandler[] = [];

  registerHandler(handler: CustomRouteHandler) {
    this.customHandlers.push(handler);
    return () => {
      this.customHandlers = this.customHandlers.filter((h) => h !== handler);
    };
  }

  reset(customInitialState?: Partial<MockServerState>) {
    this.state = {
      transactions: customInitialState?.transactions
        ? [...customInitialState.transactions]
        : [...defaultMockTransactions],
      clients: customInitialState?.clients
        ? [...customInitialState.clients]
        : [...defaultMockClients],
      subscriptions: customInitialState?.subscriptions
        ? [...customInitialState.subscriptions]
        : [],
      preferences: customInitialState?.preferences
        ? { ...customInitialState.preferences }
        : { ...defaultMockPreferences },
      notifications: customInitialState?.notifications
        ? [...customInitialState.notifications]
        : [...defaultMockNotifications],
    };
    this.requests = [];
    this.errorOverrides.clear();
    this.pendingRoutes.clear();
    this.pendingResolvers.clear();
    this.customHandlers = [];
  }

  setNotifications(notifications: NotificationItem[]) {
    this.state.notifications = [...notifications];
  }

  setTransactions(transactions: Transaction[]) {
    this.state.transactions = [...transactions];
  }

  setClients(clients: Client[]) {
    this.state.clients = [...clients];
  }

  setSubscriptions(subscriptions: Subscription[]) {
    this.state.subscriptions = [...subscriptions];
  }

  setPreferences(preferences: Partial<UserPreferences>) {
    this.state.preferences = { ...this.state.preferences, ...preferences };
  }

  getState(): MockServerState {
    return this.state;
  }

  setError(pathSnippet: string, status: number, body: any) {
    this.errorOverrides.set(pathSnippet, { status, body, once: false });
  }

  setErrorOnce(pathSnippet: string, status: number, body: any) {
    this.errorOverrides.set(pathSnippet, { status, body, once: true });
  }

  clearError(pathSnippet: string) {
    this.errorOverrides.delete(pathSnippet);
  }

  setPending(pathSnippet: string, method?: string) {
    const key = method ? `${method.toUpperCase()}:${pathSnippet}` : pathSnippet;
    this.pendingRoutes.add(key);
  }

  getPendingCount(pathSnippet: string, method?: string): number {
    const key = method ? `${method.toUpperCase()}:${pathSnippet}` : pathSnippet;
    return (this.pendingResolvers.get(key) || []).length;
  }

  resolvePending(pathSnippet: string, responseData?: any, status = 200, method?: string) {
    const key = method ? `${method.toUpperCase()}:${pathSnippet}` : pathSnippet;
    this.pendingRoutes.delete(key);
    const resolvers = this.pendingResolvers.get(key);
    if (resolvers) {
      this.pendingResolvers.delete(key);
      const res = createMockResponse(status, responseData ?? this.getDefaultResponseForPath(pathSnippet));
      resolvers.forEach(({ resolve }) => resolve(res));
    }
  }

  private getDefaultResponseForPath(pathSnippet: string): any {
    if (pathSnippet.includes('/api/dashboard/overview')) {
      return {
        clients: [...this.state.clients],
        subscriptions: [...this.state.subscriptions],
        transactions: [...this.state.transactions],
      };
    }
    if (pathSnippet.includes('/api/user/preferences')) {
      return { ...this.state.preferences };
    }
    return { success: true };
  }

  getRequests(): RecordedRequest[] {
    return [...this.requests];
  }

  getWriteRequests(): RecordedRequest[] {
    return this.requests.filter((r) => r.method !== 'GET');
  }

  getRequestCount(method: string, pathSnippet: string): number {
    const m = method.toUpperCase();
    return this.requests.filter((r) => r.method === m && r.path.includes(pathSnippet)).length;
  }

  clearRequests() {
    this.requests = [];
  }

  fetchHandler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    // Normalize url pathname
    let path = urlStr;
    try {
      const parsed = new URL(urlStr, 'http://10.0.2.2:3000');
      path = parsed.pathname;
    } catch {
      // urlStr might already be a path
    }

    const method = (init?.method || 'GET').toUpperCase();

    let body: any = undefined;
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = init.body;
        }
      } else {
        body = init.body;
      }
    }

    const recorded: RecordedRequest = {
      method,
      url: urlStr,
      path,
      headers: init?.headers as Record<string, string> | undefined,
      body,
    };
    this.requests.push(recorded);

    // Check error overrides
    for (const [key, err] of Array.from(this.errorOverrides.entries())) {
      if (path.includes(key)) {
        if (err.once) {
          this.errorOverrides.delete(key);
        }
        return createMockResponse(err.status, err.body);
      }
    }

    // Check pending routes
    for (const pendingKey of Array.from(this.pendingRoutes)) {
      if (pendingKey.includes(':')) {
        const [pMethod, pPath] = pendingKey.split(':');
        if (method === pMethod && path.includes(pPath)) {
          return new Promise<Response>((resolve, reject) => {
            const list = this.pendingResolvers.get(pendingKey) || [];
            list.push({ resolve, reject });
            this.pendingResolvers.set(pendingKey, list);
          });
        }
      } else if (path.includes(pendingKey)) {
        return new Promise<Response>((resolve, reject) => {
          const list = this.pendingResolvers.get(pendingKey) || [];
          list.push({ resolve, reject });
          this.pendingResolvers.set(pendingKey, list);
        });
      }
    }

    // Route matching
    // 1. GET /api/dashboard/overview
    if (method === 'GET' && path === '/api/dashboard/overview') {
      return createMockResponse(200, {
        clients: [...this.state.clients],
        subscriptions: [...this.state.subscriptions],
        transactions: [...this.state.transactions],
      });
    }

    // 2. GET /api/user/preferences
    if (method === 'GET' && path === '/api/user/preferences') {
      return createMockResponse(200, { ...this.state.preferences });
    }

    // 3. PATCH /api/user/preferences
    if (method === 'PATCH' && path === '/api/user/preferences') {
      this.state.preferences = { ...this.state.preferences, ...body };
      return createMockResponse(200, { ...this.state.preferences });
    }

    // 3b. GET /api/notifications
    if (method === 'GET' && path === '/api/notifications') {
      const notifs = this.state.notifications || [];
      const unread = notifs.filter((n) => !n.read).length;
      return createMockResponse(200, { notifications: notifs, unread });
    }

    // 3c. POST /api/notifications/mark-read
    if (method === 'POST' && path === '/api/notifications/mark-read') {
      const id = body?.id;
      if (id) {
        this.state.notifications = (this.state.notifications || []).map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
      } else {
        this.state.notifications = (this.state.notifications || []).map((n) => ({
          ...n,
          read: true,
        }));
      }
      const unread = (this.state.notifications || []).filter((n) => !n.read).length;
      return createMockResponse(200, { unread });
    }

    // 4. POST /api/transactions/create
    if (method === 'POST' && path === '/api/transactions/create') {
      const newTx: Transaction = {
        id: body?.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: body?.name || 'Untitled',
        amount: Number(body?.amount) || 0,
        type: body?.type || 'EXPENSE',
        status: body?.status || 'COMPLETED',
        date: body?.date || new Date().toISOString(),
        sourceType: body?.sourceType || 'manual',
        categoryId: body?.categoryId || 'OTHER',
        notes: body?.notes,
        clientId: body?.clientId,
        isAuto: body?.isAuto,
        expectedDate: body?.expectedDate,
        completedAt: body?.completedAt,
      };
      this.state.transactions = [newTx, ...this.state.transactions];
      return createMockResponse(201, newTx);
    }

    // 5. POST /api/transactions/pending/:id/complete
    const completeMatch = path.match(/^\/api\/transactions\/pending\/([^/]+)\/complete$/);
    if (method === 'POST' && completeMatch) {
      const id = completeMatch[1];
      const idx = this.state.transactions.findIndex((t) => t.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Pending transaction not found' });
      }
      const tx = this.state.transactions[idx];
      const completedDate = body?.completedDate || new Date().toISOString();
      const updated: Transaction = {
        ...tx,
        status: 'COMPLETED',
        completedAt: completedDate,
        date: completedDate,
      };
      this.state.transactions[idx] = updated;
      return createMockResponse(200, updated);
    }

    // 6. POST /api/transactions/pending/:id/revert
    const revertMatch = path.match(/^\/api\/transactions\/pending\/([^/]+)\/revert$/);
    if (method === 'POST' && revertMatch) {
      const id = revertMatch[1];
      const idx = this.state.transactions.findIndex((t) => t.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Transaction not found' });
      }
      const tx = this.state.transactions[idx];
      const updated: Transaction = {
        ...tx,
        status: 'PENDING',
        completedAt: undefined,
        date: tx.expectedDate || tx.date,
      };
      this.state.transactions[idx] = updated;
      return createMockResponse(200, updated);
    }

    // 7. POST /api/transactions/pending
    if (method === 'POST' && path === '/api/transactions/pending') {
      const newTx: Transaction = {
        id: body?.id || `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: body?.note || body?.name || 'Pending Payment',
        amount: Number(body?.amount) || 0,
        type: 'INCOME',
        status: 'PENDING',
        date: body?.expectedDate || new Date().toISOString(),
        expectedDate: body?.expectedDate,
        sourceType: 'client',
        categoryId: 'CLIENT',
        clientId: body?.clientId,
        notes: body?.note || body?.notes,
      };
      this.state.transactions = [newTx, ...this.state.transactions];
      return createMockResponse(201, newTx);
    }

    // 8. PATCH /api/transactions/pending/:id
    const pendingPatchMatch = path.match(/^\/api\/transactions\/pending\/([^/]+)$/);
    if (method === 'PATCH' && pendingPatchMatch) {
      const id = pendingPatchMatch[1];
      const idx = this.state.transactions.findIndex((t) => t.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Pending transaction not found' });
      }
      const tx = this.state.transactions[idx];
      const updated: Transaction = {
        ...tx,
        ...(body?.amount !== undefined ? { amount: Number(body.amount) } : {}),
        ...(body?.expectedDate !== undefined ? { expectedDate: body.expectedDate, date: body.expectedDate } : {}),
        ...(body?.note !== undefined ? { notes: body.note } : {}),
        ...(body?.notes !== undefined ? { notes: body.notes } : {}),
      };
      this.state.transactions[idx] = updated;
      return createMockResponse(200, updated);
    }

    // 9. DELETE /api/transactions/pending/:id
    const pendingDeleteMatch = path.match(/^\/api\/transactions\/pending\/([^/]+)$/);
    if (method === 'DELETE' && pendingDeleteMatch) {
      const id = pendingDeleteMatch[1];
      this.state.transactions = this.state.transactions.filter((t) => t.id !== id);
      return createMockResponse(200, { success: true });
    }

    // 10. PUT /api/transactions/update/:id
    const updateMatch = path.match(/^\/api\/transactions\/update\/(.+)$/);
    if (method === 'PUT' && updateMatch) {
      const id = updateMatch[1];
      const idx = this.state.transactions.findIndex((t) => t.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Transaction not found' });
      }
      const updated = { ...this.state.transactions[idx], ...body, id };
      this.state.transactions[idx] = updated;
      return createMockResponse(200, updated);
    }

    // 11. DELETE /api/transactions/delete/:id
    const deleteMatch = path.match(/^\/api\/transactions\/delete\/(.+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const id = deleteMatch[1];
      this.state.transactions = this.state.transactions.filter((t) => t.id !== id);
      return createMockResponse(200, { success: true });
    }

    // Helper for syncing one-time client transaction matching backend linked-transactions.ts
    const syncOneTimeTx = (client: Client) => {
      const txId = `auto-client-onetime-${client.id}`;
      const wanted =
        client.paymentType === 'onetime' &&
        !client.archivedAt &&
        client.status !== 'PROSPECT' &&
        client.status !== 'INACTIVE' &&
        client.revenue > 0;

      if (!wanted) {
        this.state.transactions = this.state.transactions.filter((tx) => tx.id !== txId);
        return;
      }

      const dateStr = client.paymentDate || new Date().toISOString().slice(0, 10);
      const isPastOrToday = dateStr <= new Date().toISOString().slice(0, 10);
      const existingIdx = this.state.transactions.findIndex((tx) => tx.id === txId);
      const txObj: Transaction = {
        id: txId,
        name: `${client.name} one-time payment`,
        amount: client.revenue,
        type: 'INCOME',
        status: isPastOrToday ? 'COMPLETED' : 'PENDING',
        date: dateStr,
        sourceType: 'client',
        categoryId: 'CLIENT',
        clientId: client.id,
      };
      if (existingIdx !== -1) {
        this.state.transactions[existingIdx] = txObj;
      } else {
        this.state.transactions = [txObj, ...this.state.transactions];
      }
    };

    // 12. GET /api/clients
    if (method === 'GET' && path === '/api/clients') {
      return createMockResponse(200, [...this.state.clients]);
    }

    // 13. POST /api/clients/create
    if (method === 'POST' && path === '/api/clients/create') {
      const newClient: Client = {
        id: body?.id || `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: body?.name || 'Untitled',
        revenue: Number(body?.revenue) || 0,
        clientType: body?.clientType || 'COMPANY',
        status: body?.status || 'ACTIVE',
        paymentType: body?.paymentType || 'onetime',
        paymentDate: body?.paymentDate,
        billingDay: body?.billingDay,
        nextBillingDate: body?.nextBillingDate,
        company: body?.company,
        email: body?.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: body?.archivedAt,
      };
      this.state.clients = [newClient, ...this.state.clients];
      syncOneTimeTx(newClient);
      return createMockResponse(201, newClient);
    }

    // 14. PUT /api/clients/update/:id
    const clientUpdateMatch = path.match(/^\/api\/clients\/update\/(.+)$/);
    if (method === 'PUT' && clientUpdateMatch) {
      const id = clientUpdateMatch[1];
      const idx = this.state.clients.findIndex((c) => c.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Client not found' });
      }
      const updated: Client = {
        ...this.state.clients[idx],
        ...body,
        id,
        updatedAt: new Date().toISOString(),
      };
      this.state.clients[idx] = updated;
      syncOneTimeTx(updated);
      return createMockResponse(200, updated);
    }

    // 15. DELETE /api/clients/delete/:id (Archive)
    const clientArchiveMatch = path.match(/^\/api\/clients\/delete\/(.+)$/);
    if (method === 'DELETE' && clientArchiveMatch) {
      const id = clientArchiveMatch[1];
      const idx = this.state.clients.findIndex((c) => c.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Client not found' });
      }
      const archived: Client = {
        ...this.state.clients[idx],
        status: 'INACTIVE',
        archivedAt: new Date().toISOString(),
      };
      this.state.clients[idx] = archived;
      syncOneTimeTx(archived);
      return createMockResponse(200, archived);
    }

    // 16. PATCH /api/clients/restore/:id (Restore)
    const clientRestoreMatch = path.match(/^\/api\/clients\/restore\/(.+)$/);
    if (method === 'PATCH' && clientRestoreMatch) {
      const id = clientRestoreMatch[1];
      const idx = this.state.clients.findIndex((c) => c.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Client not found' });
      }
      const restored: Client = {
        ...this.state.clients[idx],
        status: 'ACTIVE',
        archivedAt: undefined,
      };
      this.state.clients[idx] = restored;
      syncOneTimeTx(restored);
      return createMockResponse(200, restored);
    }

    // 17. DELETE /api/clients/delete-permanent/:id
    const clientPermanentMatch = path.match(/^\/api\/clients\/delete-permanent\/(.+)$/);
    if (method === 'DELETE' && clientPermanentMatch) {
      const id = clientPermanentMatch[1];
      const idx = this.state.clients.findIndex((c) => c.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Client not found' });
      }
      this.state.clients = this.state.clients.filter((c) => c.id !== id);
      this.state.transactions = this.state.transactions.filter(
        (tx) => tx.clientId !== id && !(tx.sourceType === 'client' && tx.sourceId === id)
      );
      return createMockResponse(200, { id });
    }

    // 18. GET /api/clients/:id/transaction-count
    const clientCountMatch = path.match(/^\/api\/clients\/([^/]+)\/transaction-count$/);
    if (method === 'GET' && clientCountMatch) {
      const id = clientCountMatch[1];
      const count = this.state.transactions.filter(
        (tx) => tx.clientId === id || (tx.sourceType === 'client' && tx.sourceId === id)
      ).length;
      return createMockResponse(200, { count });
    }

    // 19. POST /api/clients/:id/record-payment
    const clientRecordPaymentMatch = path.match(/^\/api\/clients\/([^/]+)\/record-payment$/);
    if (method === 'POST' && clientRecordPaymentMatch) {
      const id = clientRecordPaymentMatch[1];
      const client = this.state.clients.find((c) => c.id === id);
      if (!client) {
        return createMockResponse(404, { error: 'Client not found' });
      }
      if (client.paymentType !== 'retainer') {
        return createMockResponse(400, { error: 'Only monthly retainer clients can record recurring payments' });
      }
      if (client.status !== 'ACTIVE') {
        return createMockResponse(400, { error: 'Only active clients can record recurring payments' });
      }

      // Backend recurring-billing.ts line 107 prioritizes nextBillingDate over today
      const paymentDate = client.nextBillingDate || body?.today || new Date().toISOString();
      const tx: Transaction = {
        id: `tx-client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: `${client.name} retainer payment`,
        amount: client.revenue,
        type: 'INCOME',
        status: 'COMPLETED',
        date: paymentDate,
        sourceType: 'client',
        categoryId: 'CLIENT',
        clientId: client.id,
      };
      this.state.transactions = [tx, ...this.state.transactions];

      const currentBillingDate = new Date(client.nextBillingDate || paymentDate);
      const nextDate = new Date(
        currentBillingDate.getFullYear(),
        currentBillingDate.getMonth() + 1,
        currentBillingDate.getDate(),
        12
      );
      const updatedClient: Client = {
        ...client,
        nextBillingDate: nextDate.toISOString().slice(0, 10),
      };
      const clientIdx = this.state.clients.findIndex((c) => c.id === id);
      if (clientIdx !== -1) {
        this.state.clients[clientIdx] = updatedClient;
      }
      return createMockResponse(201, { client: updatedClient, transaction: tx });
    }

    // 20. GET /api/subscriptions
    if (method === 'GET' && path === '/api/subscriptions') {
      return createMockResponse(200, [...this.state.subscriptions]);
    }

    // 21. POST /api/subscriptions/create
    if (method === 'POST' && path === '/api/subscriptions/create') {
      const billingDay = Number(body?.billingDay) || 1;
      const safeDay = Math.min(28, Math.max(1, billingDay));
      let nextBilling = body?.nextBillingDate;
      if (!nextBilling) {
        const now = new Date();
        const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), safeDay, 12));
        nextBilling = candidate.toISOString().slice(0, 10);
      }
      const newSub: Subscription = {
        id: body?.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: body?.name || 'Untitled',
        amount: Number(body?.amount) || 0,
        cycle: body?.cycle || 'MONTHLY',
        billingCycle: body?.billingCycle || body?.cycle || 'MONTHLY',
        billingDay: safeDay,
        nextBillingDate: nextBilling,
        status: body?.status || 'ACTIVE',
        notes: body?.notes,
        archivedAt: body?.archivedAt,
      };
      this.state.subscriptions = [newSub, ...this.state.subscriptions];
      return createMockResponse(201, newSub);
    }

    // 22. PUT /api/subscriptions/update/:id
    const subUpdateMatch = path.match(/^\/api\/subscriptions\/update\/(.+)$/);
    if (method === 'PUT' && subUpdateMatch) {
      const id = subUpdateMatch[1];
      const idx = this.state.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Subscription not found' });
      }
      const existing = this.state.subscriptions[idx];
      const updated: Subscription = {
        ...existing,
        ...body,
        id,
        cycle: body?.cycle || body?.billingCycle || existing.cycle,
        billingCycle: body?.billingCycle || body?.cycle || existing.billingCycle,
      };
      this.state.subscriptions[idx] = updated;
      return createMockResponse(200, updated);
    }

    // 23. DELETE /api/subscriptions/delete/:id (Archive)
    const subArchiveMatch = path.match(/^\/api\/subscriptions\/delete\/(.+)$/);
    if (method === 'DELETE' && subArchiveMatch) {
      const id = subArchiveMatch[1];
      const idx = this.state.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Subscription not found' });
      }
      const archived: Subscription = {
        ...this.state.subscriptions[idx],
        status: 'INACTIVE',
        archivedAt: new Date().toISOString(),
      };
      this.state.subscriptions[idx] = archived;
      return createMockResponse(200, archived);
    }

    // 24. PATCH /api/subscriptions/restore/:id (Restore)
    const subRestoreMatch = path.match(/^\/api\/subscriptions\/restore\/(.+)$/);
    if (method === 'PATCH' && subRestoreMatch) {
      const id = subRestoreMatch[1];
      const idx = this.state.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Subscription not found' });
      }
      if (!this.state.subscriptions[idx].archivedAt) {
        return createMockResponse(400, { error: 'Subscription is not archived' });
      }
      const restored: Subscription = {
        ...this.state.subscriptions[idx],
        status: 'ACTIVE',
        archivedAt: undefined,
      };
      this.state.subscriptions[idx] = restored;
      return createMockResponse(200, restored);
    }

    // 25. DELETE /api/subscriptions/delete-permanent/:id
    const subPermanentMatch = path.match(/^\/api\/subscriptions\/delete-permanent\/(.+)$/);
    if (method === 'DELETE' && subPermanentMatch) {
      const id = subPermanentMatch[1];
      const idx = this.state.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) {
        return createMockResponse(404, { error: 'Subscription not found' });
      }
      this.state.subscriptions = this.state.subscriptions.filter((s) => s.id !== id);
      this.state.transactions = this.state.transactions.filter(
        (tx) => tx.subscriptionId !== id && !(tx.sourceType === 'subscription' && tx.sourceId === id)
      );
      return createMockResponse(200, { id });
    }

    // 26. POST /api/subscriptions/:id/record-payment
    const subRecordPaymentMatch = path.match(/^\/api\/subscriptions\/([^/]+)\/record-payment$/);
    if (method === 'POST' && subRecordPaymentMatch) {
      const id = subRecordPaymentMatch[1];
      const sub = this.state.subscriptions.find((s) => s.id === id);
      if (!sub) {
        return createMockResponse(404, { error: 'Subscription not found' });
      }
      if (sub.status !== 'ACTIVE' || sub.archivedAt) {
        return createMockResponse(400, { error: 'Only active subscriptions can record payments' });
      }

      // Prioritize stored nextBillingDate over today (recurring-billing.ts lines 137-155)
      const rawDate = sub.nextBillingDate || body?.today || new Date().toISOString().slice(0, 10);
      const billingDateKey = typeof rawDate === 'string' ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10);
      const cycle = sub.billingCycle || sub.cycle || 'MONTHLY';

      // Deduplication check: reuse existing transaction if already recorded for this source billing date
      const existingTx = this.state.transactions.find(
        (t) =>
          t.sourceType === 'subscription' &&
          (t.sourceId === sub.id || t.subscriptionId === sub.id) &&
          (t.sourceBillingDate === billingDateKey || (t.date && t.date.slice(0, 10) === billingDateKey))
      );

      let tx: Transaction;
      if (existingTx) {
        tx = existingTx;
      } else {
        tx = {
          id: `auto-subscription-${sub.id}-${billingDateKey}`,
          name: `${sub.name} subscription payment`,
          amount: sub.amount,
          type: 'EXPENSE',
          status: 'COMPLETED',
          date: billingDateKey,
          sourceType: 'subscription',
          sourceId: sub.id,
          sourceBillingDate: billingDateKey,
          categoryId: 'TOOLS',
          subscriptionId: sub.id,
        };
        this.state.transactions = [tx, ...this.state.transactions];
      }

      // advanceBillingDate with UTC semantics matching recurring-billing.ts
      const [year, month, day] = billingDateKey.split('-').map(Number);
      const monthsToAdd = cycle === 'YEARLY' ? 12 : cycle === 'QUARTERLY' ? 3 : 1;
      const safeDay = Math.min(28, Math.max(1, day || 1));
      const nextUtc = new Date(Date.UTC(year, (month - 1) + monthsToAdd, safeDay, 12));
      const nextDateStr = nextUtc.toISOString().slice(0, 10);

      const updatedSub: Subscription = {
        ...sub,
        nextBillingDate: nextDateStr,
      };
      const subIdx = this.state.subscriptions.findIndex((s) => s.id === id);
      if (subIdx !== -1) {
        this.state.subscriptions[subIdx] = updatedSub;
      }
      return createMockResponse(201, { subscription: updatedSub, transaction: tx });
    }

    for (const handler of this.customHandlers) {
      const customRes = await handler(method, path, body, recorded, this);
      if (customRes) return customRes;
    }

    return createMockResponse(404, { error: `Not found: ${method} ${path}` });
  };
}

export const mockServer = new MockHttpServer();
