import {
  computeInvoiceTotals,
  effectiveInvoiceStatus,
  computeInvoiceSummariesByCurrency,
} from '@haseela/shared';
import type { Invoice } from '@haseela/shared';

describe('Invoice Calculations & Summaries', () => {
  describe('computeInvoiceTotals', () => {
    it('calculates totals with rounding and discount before tax', () => {
      // Worked example:
      // Item 1: 2 * 1500 = 3000
      // Item 2: 1 * 1200 = 1200
      // Subtotal = 4200
      // Discount = 200 -> Discounted = 4000
      // Tax rate = 8.5% -> Tax = 4000 * 0.085 = 340
      // Total = 4340
      const items = [
        { description: 'Brand identity', quantity: 2, rate: 1500 },
        { description: 'Style guide', quantity: 1, rate: 1200 },
      ];
      const result = computeInvoiceTotals(items, 8.5, 200);

      expect(result.subtotal).toBe(4200);
      expect(result.taxAmount).toBe(340);
      expect(result.total).toBe(4340);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].amount).toBe(3000);
      expect(result.items[1].amount).toBe(1200);
    });

    it('floors discounted subtotal at 0 when discount exceeds subtotal', () => {
      const items = [{ description: 'Quick fix', quantity: 1, rate: 50 }];
      const result = computeInvoiceTotals(items, 15, 100);

      expect(result.subtotal).toBe(50);
      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('handles decimal quantities and fractional cents rounding', () => {
      // 3.5 hours * 33.33/hr = 116.655 -> round2 = 116.66
      const items = [{ description: 'Consulting', quantity: 3.5, rate: 33.33 }];
      const result = computeInvoiceTotals(items, 0, 0);

      expect(result.subtotal).toBe(116.66);
      expect(result.total).toBe(116.66);
    });
  });

  describe('effectiveInvoiceStatus', () => {
    const fixedNow = new Date('2026-03-20T12:00:00.000Z');

    it('derives OVERDUE when status is SENT and due date is in the past', () => {
      const status = effectiveInvoiceStatus('SENT', '2026-03-10T00:00:00.000Z', fixedNow);
      expect(status).toBe('OVERDUE');
    });

    it('keeps SENT when due date is in the future', () => {
      const status = effectiveInvoiceStatus('SENT', '2026-03-25T00:00:00.000Z', fixedNow);
      expect(status).toBe('SENT');
    });

    it('does not change DRAFT or PAID even if due date is past', () => {
      expect(effectiveInvoiceStatus('DRAFT', '2026-01-01T00:00:00.000Z', fixedNow)).toBe('DRAFT');
      expect(effectiveInvoiceStatus('PAID', '2026-01-01T00:00:00.000Z', fixedNow)).toBe('PAID');
    });
  });

  describe('computeInvoiceSummariesByCurrency', () => {
    const now = new Date('2026-03-20T12:00:00.000Z');
    const within30d = new Date('2026-03-10T10:00:00.000Z').toISOString();
    const beyond30d = new Date('2026-01-15T10:00:00.000Z').toISOString();

    const mockInvoices: Invoice[] = [
      // USD invoices
      {
        id: '1',
        number: 'INV-1',
        status: 'SENT',
        currency: 'USD',
        dueDate: '2026-03-25T00:00:00.000Z', // Future -> SENT
        total: 1000,
        subtotal: 1000,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        issueDate: '2026-03-01T00:00:00.000Z',
        lineItems: [],
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      },
      {
        id: '2',
        number: 'INV-2',
        status: 'SENT',
        currency: 'USD',
        dueDate: '2026-03-10T00:00:00.000Z', // Past -> OVERDUE
        total: 500,
        subtotal: 500,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        issueDate: '2026-03-01T00:00:00.000Z',
        lineItems: [],
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      },
      {
        id: '3',
        number: 'INV-3',
        status: 'PAID',
        currency: 'USD',
        dueDate: '2026-03-01T00:00:00.000Z',
        paidAt: within30d, // within 30 days
        total: 2000,
        subtotal: 2000,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        issueDate: '2026-03-01T00:00:00.000Z',
        lineItems: [],
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      },
      {
        id: '4',
        number: 'INV-4',
        status: 'PAID',
        currency: 'USD',
        dueDate: '2026-01-10T00:00:00.000Z',
        paidAt: beyond30d, // > 30 days ago
        total: 3000,
        subtotal: 3000,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        issueDate: '2026-01-01T00:00:00.000Z',
        lineItems: [],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      // EUR invoice
      {
        id: '5',
        number: 'INV-5',
        status: 'SENT',
        currency: 'EUR',
        dueDate: '2026-03-12T00:00:00.000Z', // Past -> OVERDUE
        total: 750,
        subtotal: 750,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        issueDate: '2026-03-01T00:00:00.000Z',
        lineItems: [],
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
      },
    ];

    it('groups summaries strictly by currency without mixing USD and EUR', () => {
      const summaries = computeInvoiceSummariesByCurrency(mockInvoices, now);

      // USD:
      // Outstanding = 1000 (SENT) + 500 (OVERDUE) = 1500
      // Overdue = 500
      // Paid 30d = 2000 (excludes 3000 from beyond 30d)
      expect(summaries.USD).toBeDefined();
      expect(summaries.USD.outstanding).toBe(1500);
      expect(summaries.USD.overdue).toBe(500);
      expect(summaries.USD.paid30d).toBe(2000);
      expect(summaries.USD.count).toBe(4);

      // EUR:
      // Outstanding = 750
      // Overdue = 750
      // Paid 30d = 0
      expect(summaries.EUR).toBeDefined();
      expect(summaries.EUR.outstanding).toBe(750);
      expect(summaries.EUR.overdue).toBe(750);
      expect(summaries.EUR.paid30d).toBe(0);
      expect(summaries.EUR.count).toBe(1);
    });
  });
});
