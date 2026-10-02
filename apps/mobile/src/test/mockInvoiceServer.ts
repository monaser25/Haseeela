import type { Invoice, Transaction } from '@haseela/shared';
import { computeInvoiceTotals, effectiveInvoiceStatus } from '@haseela/shared';
import { createMockResponse, mockServer, MockHttpServer } from './mockServer';

// Valid minimal PDF bytes starting with %PDF-
export const MOCK_PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0, 0xd4, 0xc5, 0xd8, 0x0a,
  0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65,
  0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20,
  0x32, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a, 0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
  0x25, 0x25, 0x45, 0x4f, 0x46
]);

export const defaultMockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    number: 'INV-0044',
    clientId: 'client-1',
    client: {
      id: 'client-1',
      name: 'Acme Corp',
      company: 'Acme Corp',
      email: 'finance@acme.com',
    },
    issueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Past due -> OVERDUE
    status: 'SENT',
    currency: 'USD',
    subtotal: 1850,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    total: 1850,
    notes: 'Thanks for your business.',
    terms: 'Net 14',
    sentAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    paidAt: null,
    transactionId: null,
    lineItems: [
      {
        id: 'li-1',
        description: 'Brand Identity Strategy',
        quantity: 1,
        rate: 1850,
        amount: 1850,
        position: 0,
      },
    ],
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inv-2',
    number: 'INV-0043',
    clientId: 'client-2',
    client: {
      id: 'client-2',
      name: 'Globex Corp',
      company: 'Globex Corp',
      email: 'billing@globex.com',
    },
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // Future due -> SENT
    status: 'SENT',
    currency: 'USD',
    subtotal: 3200,
    taxRate: 10,
    taxAmount: 320,
    discount: 0,
    total: 3520,
    notes: null,
    terms: 'Net 30',
    sentAt: new Date().toISOString(),
    paidAt: null,
    transactionId: null,
    lineItems: [
      {
        id: 'li-2',
        description: 'Full Stack Development',
        quantity: 2,
        rate: 1600,
        amount: 3200,
        position: 0,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'inv-3',
    number: 'INV-0042',
    clientId: 'client-1',
    client: {
      id: 'client-1',
      name: 'Acme Corp',
      company: 'Acme Corp',
      email: 'finance@acme.com',
    },
    issueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'PAID',
    currency: 'USD',
    subtotal: 4150,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    total: 4150,
    notes: 'Paid via bank transfer',
    terms: 'Due on receipt',
    sentAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (within 30d)
    transactionId: 'tx-paid-inv-3',
    lineItems: [
      {
        id: 'li-3',
        description: 'UI/UX Mobile App Design',
        quantity: 1,
        rate: 4150,
        amount: 4150,
        position: 0,
      },
    ],
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'inv-4',
    number: 'INV-0041',
    clientId: null,
    client: null,
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'DRAFT',
    currency: 'EUR',
    subtotal: 890,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    total: 890,
    notes: 'Draft proposal',
    terms: null,
    sentAt: null,
    paidAt: null,
    transactionId: null,
    lineItems: [
      {
        id: 'li-4',
        description: 'Consultation & Auditing',
        quantity: 1,
        rate: 890,
        amount: 890,
        position: 0,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class MockInvoiceStore {
  private invoices: Invoice[] = [...defaultMockInvoices];

  reset(customInvoices?: Invoice[]) {
    this.invoices = customInvoices ? [...customInvoices] : [...defaultMockInvoices];
  }

  getInvoices(): Invoice[] {
    return this.invoices.map((inv) => ({
      ...inv,
      status: effectiveInvoiceStatus(inv.status, inv.dueDate),
    }));
  }

  setInvoices(invoices: Invoice[]) {
    this.invoices = [...invoices];
  }

  findInvoice(id: string): Invoice | undefined {
    const inv = this.invoices.find((i) => i.id === id);
    if (!inv) return undefined;
    return {
      ...inv,
      status: effectiveInvoiceStatus(inv.status, inv.dueDate),
    };
  }

  routeHandler = async (
    method: string,
    path: string,
    body: any,
    _req: any,
    server: MockHttpServer
  ): Promise<Response | null> => {
    // 1. GET /api/invoices
    if (method === 'GET' && path === '/api/invoices') {
      const derived = this.getInvoices();
      return createMockResponse(200, { invoices: derived });
    }

    // 2. POST /api/invoices/create
    if (method === 'POST' && path === '/api/invoices/create') {
      const { items, subtotal, taxAmount, total } = computeInvoiceTotals(
        body.lineItems || [],
        body.taxRate || 0,
        body.discount || 0
      );

      const nextNum = body.number || `INV-${String(this.invoices.length + 1).padStart(4, '0')}`;
      const client = server.getState().clients.find((c) => c.id === body.clientId) || null;

      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        number: nextNum,
        clientId: body.clientId || null,
        client: client
          ? { id: client.id, name: client.name, company: client.company || null, email: client.email || null }
          : null,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        status: body.status === 'PAID' ? 'PAID' : 'DRAFT',
        currency: body.currency || 'USD',
        subtotal,
        taxRate: body.taxRate || 0,
        taxAmount,
        discount: body.discount || 0,
        total,
        notes: body.notes || null,
        terms: body.terms || null,
        sentAt: null,
        paidAt: null,
        transactionId: null,
        lineItems: items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.invoices = [newInvoice, ...this.invoices];
      return createMockResponse(201, newInvoice);
    }

    // 3. PUT /api/invoices/update/{id}
    const updateMatch = path.match(/^\/api\/invoices\/update\/([^/]+)$/);
    if (method === 'PUT' && updateMatch) {
      const id = updateMatch[1];
      const existing = this.invoices.find((i) => i.id === id);
      if (!existing) {
        return createMockResponse(404, { error: 'Invoice not found' });
      }

      const { items, subtotal, taxAmount, total } = computeInvoiceTotals(
        body.lineItems || [],
        body.taxRate || 0,
        body.discount || 0
      );

      const client = body.clientId
        ? server.getState().clients.find((c) => c.id === body.clientId) || null
        : null;

      const updated: Invoice = {
        ...existing,
        number: body.number || existing.number,
        clientId: body.clientId || null,
        client: client
          ? { id: client.id, name: client.name, company: client.company || null, email: client.email || null }
          : existing.client,
        issueDate: body.issueDate || existing.issueDate,
        dueDate: body.dueDate || existing.dueDate,
        status: body.status !== undefined ? body.status : existing.status,
        currency: body.currency || existing.currency,
        subtotal,
        taxRate: body.taxRate ?? existing.taxRate,
        taxAmount,
        discount: body.discount ?? existing.discount,
        total,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        terms: body.terms !== undefined ? body.terms : existing.terms,
        lineItems: items,
        updatedAt: new Date().toISOString(),
      };

      this.invoices = this.invoices.map((i) => (i.id === id ? updated : i));
      return createMockResponse(200, updated);
    }

    // 4. DELETE /api/invoices/delete/{id}
    const deleteMatch = path.match(/^\/api\/invoices\/delete\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const id = deleteMatch[1];
      const existing = this.invoices.find((i) => i.id === id);
      if (!existing) {
        return createMockResponse(404, { error: 'Invoice not found' });
      }
      this.invoices = this.invoices.filter((i) => i.id !== id);
      return createMockResponse(200, { id });
    }

    // 5. POST /api/invoices/{id}/mark-paid
    const markPaidMatch = path.match(/^\/api\/invoices\/([^/]+)\/mark-paid$/);
    if (method === 'POST' && markPaidMatch) {
      const id = markPaidMatch[1];
      const existing = this.invoices.find((i) => i.id === id);
      if (!existing) {
        return createMockResponse(404, { error: 'Invoice not found' });
      }

      // Idempotency: if already paid, return null transaction
      if (existing.status === 'PAID') {
        return createMockResponse(200, { invoice: existing, transaction: null });
      }

      const paidAt = new Date().toISOString();
      const transactionId = `tx-invoice-${existing.id}`;

      const createdTransaction: Transaction = {
        id: transactionId,
        name: `Payment — ${existing.number}`,
        amount: existing.total,
        type: 'INCOME',
        status: 'COMPLETED',
        date: paidAt,
        sourceType: 'manual',
        categoryId: 'CLIENT',
        clientId: existing.clientId || undefined,
        isAuto: true,
      };

      // Upsert into mockServer transactions
      server.setTransactions([createdTransaction, ...server.getState().transactions]);

      const updated: Invoice = {
        ...existing,
        status: 'PAID',
        paidAt,
        transactionId,
        updatedAt: paidAt,
      };

      this.invoices = this.invoices.map((i) => (i.id === id ? updated : i));
      return createMockResponse(200, { invoice: updated, transaction: createdTransaction });
    }

    // 6. POST /api/invoices/{id}/send
    const sendMatch = path.match(/^\/api\/invoices\/([^/]+)\/send$/);
    if (method === 'POST' && sendMatch) {
      const id = sendMatch[1];
      const existing = this.invoices.find((i) => i.id === id);
      if (!existing) {
        return createMockResponse(404, { error: 'Invoice not found' });
      }

      const sentAt = new Date().toISOString();
      const updated: Invoice = {
        ...existing,
        status: 'SENT',
        sentAt: existing.sentAt || sentAt,
        updatedAt: sentAt,
      };

      this.invoices = this.invoices.map((i) => (i.id === id ? updated : i));
      return createMockResponse(200, {
        invoice: updated,
        attached: true,
        sentTo: body.to,
      });
    }

    // 7. GET /api/invoices/{id}/pdf
    const pdfMatch = path.match(/^\/api\/invoices\/([^/]+)\/pdf$/);
    if (method === 'GET' && pdfMatch) {
      const id = pdfMatch[1];
      const existing = this.invoices.find((i) => i.id === id);
      if (!existing) {
        return createMockResponse(404, { error: 'Invoice not found' });
      }
      return createMockResponse(200, MOCK_PDF_BYTES, {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="invoice-${existing.number}.pdf"`,
      });
    }

    return null;
  };
}

export const mockInvoiceStore = new MockInvoiceStore();

export function setupMockInvoiceServer(server: MockHttpServer = mockServer) {
  return server.registerHandler(mockInvoiceStore.routeHandler);
}
