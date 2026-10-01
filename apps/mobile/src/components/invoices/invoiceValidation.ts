import type { CurrencyCode } from '@haseela/shared';
import { parseLocaleAmount } from '../transactions/parseAmount';
import { parseCalendarDate, formatCalendarDate } from '../../utils/calendarDate';
import { computeInvoiceTotals } from '@haseela/shared';

export interface InvoiceFormLineItem {
  id?: string;
  description: string;
  quantity: string;
  rate: string;
}

export interface InvoiceFormData {
  number?: string;
  clientId?: string | null;
  currency: CurrencyCode;
  issueDate: Date;
  dueDate: Date;
  taxRate: string;
  discount: string;
  notes?: string;
  terms?: string;
  lineItems: InvoiceFormLineItem[];
}

export interface InvoiceFormErrors {
  general?: string;
  dates?: string;
  lineItems?: Record<number, { description?: string; quantity?: string; rate?: string }>;
  taxRate?: string;
  discount?: string;
}

export function validateInvoiceForm(
  data: InvoiceFormData,
  t: (key: any, vars?: any) => string
): { isValid: boolean; errors: InvoiceFormErrors } {
  const errors: InvoiceFormErrors = {};
  let isValid = true;

  // Validate dates: due date >= issue date
  const issueStr = formatCalendarDate(data.issueDate);
  const dueStr = formatCalendarDate(data.dueDate);
  if (dueStr < issueStr) {
    errors.dates = t('invoices.editor.errorValidDates');
    isValid = false;
  }

  // Validate line items
  if (!data.lineItems || data.lineItems.length === 0) {
    errors.general = t('invoices.editor.errorNoLineItems');
    isValid = false;
  } else {
    const itemErrors: Record<number, { description?: string; quantity?: string; rate?: string }> = {};

    data.lineItems.forEach((item, index) => {
      const err: { description?: string; quantity?: string; rate?: string } = {};

      if (!item.description || item.description.trim() === '') {
        err.description = t('invoices.editor.errorNoLineItems');
        isValid = false;
      }

      const qty = parseLocaleAmount(item.quantity);
      if (Number.isNaN(qty) || !Number.isFinite(qty) || qty <= 0) {
        err.quantity = t('invoices.editor.errorInvalidQuantity');
        isValid = false;
      }

      const rate = parseLocaleAmount(item.rate);
      if (Number.isNaN(rate) || !Number.isFinite(rate) || rate < 0) {
        err.rate = t('invoices.editor.errorInvalidRate');
        isValid = false;
      }

      if (Object.keys(err).length > 0) {
        itemErrors[index] = err;
      }
    });

    if (Object.keys(itemErrors).length > 0) {
      errors.lineItems = itemErrors;
    }
  }

  // Validate tax rate (0..100)
  if (data.taxRate && data.taxRate.trim() !== '') {
    const tax = parseLocaleAmount(data.taxRate);
    if (Number.isNaN(tax) || !Number.isFinite(tax) || tax < 0 || tax > 100) {
      errors.taxRate = t('invoices.editor.errorInvalidTax');
      isValid = false;
    }
  }

  // Validate discount (>= 0)
  if (data.discount && data.discount.trim() !== '') {
    const disc = parseLocaleAmount(data.discount);
    if (Number.isNaN(disc) || !Number.isFinite(disc) || disc < 0) {
      errors.discount = t('invoices.editor.errorInvalidDiscount');
      isValid = false;
    }
  }

  return { isValid, errors };
}

export function calculateLiveTotals(
  lineItems: InvoiceFormLineItem[],
  taxRateStr: string,
  discountStr: string
) {
  const parsedItems = lineItems.map((li) => {
    const qty = parseLocaleAmount(li.quantity);
    const rate = parseLocaleAmount(li.rate);
    return {
      description: li.description,
      quantity: Number.isNaN(qty) || qty < 0 ? 0 : qty,
      rate: Number.isNaN(rate) || rate < 0 ? 0 : rate,
    };
  });

  const parsedTax = parseLocaleAmount(taxRateStr);
  const taxRate = Number.isNaN(parsedTax) || parsedTax < 0 ? 0 : parsedTax;

  const parsedDiscount = parseLocaleAmount(discountStr);
  const discount = Number.isNaN(parsedDiscount) || parsedDiscount < 0 ? 0 : parsedDiscount;

  return computeInvoiceTotals(parsedItems, taxRate, discount);
}
