import type { CurrencyCode, Invoice, InvoiceLineItem, InvoiceStatus } from '../types/finance';

export type LineItemCalculationInput = {
  description: string;
  quantity: number;
  rate: number;
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute subtotal, tax, and total from line items + tax rate (%) + discount.
 * Matches web implementation with rounding and non-negative floor.
 */
export function computeInvoiceTotals(
  lineItems: LineItemCalculationInput[],
  taxRate: number,
  discount: number
): {
  items: Array<InvoiceLineItem & { amount: number; position: number }>;
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const items = lineItems.map((li, i) => ({
    description: li.description,
    quantity: li.quantity,
    rate: li.rate,
    amount: round2(li.quantity * li.rate),
    position: i,
  }));
  const subtotal = round2(items.reduce((sum, li) => sum + li.amount, 0));
  const discounted = Math.max(0, round2(subtotal - (discount || 0)));
  const taxAmount = round2(discounted * ((taxRate || 0) / 100));
  const total = round2(discounted + taxAmount);
  return { items, subtotal, taxAmount, total };
}

/**
 * Derives the effective status: a SENT invoice past its due date reads as OVERDUE.
 */
export function effectiveInvoiceStatus(
  status: InvoiceStatus,
  dueDate: Date | string,
  now: Date = new Date()
): InvoiceStatus {
  if (status !== 'SENT') return status;
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return due.getTime() < now.getTime() ? 'OVERDUE' : 'SENT';
}

export interface InvoiceCurrencySummary {
  outstanding: number;
  overdue: number;
  paid30d: number;
  count: number;
}

/**
 * Summarizes invoices by currency without cross-currency conversion or mixing.
 * Outstanding = sum of SENT + OVERDUE totals.
 * Overdue = sum of OVERDUE totals.
 * Paid 30d = sum of PAID totals where paidAt is within the past 30 days of `now`.
 */
export function computeInvoiceSummariesByCurrency(
  invoices: Invoice[],
  now: Date = new Date()
): Record<CurrencyCode, InvoiceCurrencySummary> {
  const summaries: Partial<Record<CurrencyCode, InvoiceCurrencySummary>> = {};
  const nowMs = now.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const inv of invoices) {
    const ccy = inv.currency || 'USD';
    if (!summaries[ccy]) {
      summaries[ccy] = { outstanding: 0, overdue: 0, paid30d: 0, count: 0 };
    }
    const current = summaries[ccy]!;
    current.count += 1;

    const status = effectiveInvoiceStatus(inv.status, inv.dueDate, now);
    if (status === 'SENT') {
      current.outstanding = round2(current.outstanding + inv.total);
    } else if (status === 'OVERDUE') {
      current.outstanding = round2(current.outstanding + inv.total);
      current.overdue = round2(current.overdue + inv.total);
    } else if (status === 'PAID' && inv.paidAt) {
      const paidTime = new Date(inv.paidAt).getTime();
      if (!Number.isNaN(paidTime) && paidTime <= nowMs && paidTime >= nowMs - thirtyDaysMs) {
        current.paid30d = round2(current.paid30d + inv.total);
      }
    }
  }

  return summaries as Record<CurrencyCode, InvoiceCurrencySummary>;
}
