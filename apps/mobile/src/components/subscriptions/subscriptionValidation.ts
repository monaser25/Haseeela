import { SubscriptionSchema } from '@haseela/shared';
import type { ZodError } from 'zod';
import { parseLocaleAmount } from '../transactions/parseAmount';
import { formatCalendarDate } from '../../utils/calendarDate';
import { normalizeDigits, parseLocalizedBillingDay } from '../clients/clientValidation';

export { normalizeDigits, parseLocalizedBillingDay };

export interface SubscriptionFormInput {
  name: string;
  amountStr: string;
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  billingDayStr: string;
  nextBillingDate: Date;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string;
}

export interface SubscriptionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  payload?: {
    name: string;
    amount: number;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    billingDay: number;
    nextBillingDate: string;
    status: 'ACTIVE' | 'INACTIVE';
    notes?: string;
  };
}

/**
 * Strictly parses subscription amount.
 * - Must be a valid positive number strictly greater than zero.
 * - Malformed, negative, or zero inputs are rejected.
 */
export function parseSubscriptionAmount(
  input: string | null | undefined
): { value: number; errorKey?: string } {
  if (input == null || !input.trim()) {
    return { value: NaN, errorKey: 'subscriptions.validation.amountPositive' };
  }

  const parsed = parseLocaleAmount(input.trim());
  if (isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) {
    return { value: NaN, errorKey: 'subscriptions.validation.amountPositive' };
  }

  return { value: parsed };
}

/**
 * Maps Zod validation errors to localized message keys.
 * Never leaks raw Zod messages or English text to the user.
 */
export function mapZodErrorToKeys(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  error.errors.forEach((err) => {
    const field = err.path[0]?.toString();
    if (!field || result[field]) return;

    switch (field) {
      case 'name':
        result[field] = 'subscriptions.validation.nameRequired';
        break;
      case 'amount':
        result[field] = 'subscriptions.validation.amountPositive';
        break;
      case 'billingDay':
        result[field] = 'subscriptions.validation.billingDayInvalid';
        break;
      default:
        result[field] = 'subscriptions.error.generic';
        break;
    }
  });
  return result;
}

/**
 * Validates full subscription form input.
 * In edit mode, guards against attempting to clear existing notes because the backend
 * preprocesses empty/null strings to undefined and leaves the database note unchanged.
 */
export function validateSubscriptionFormInput(
  input: SubscriptionFormInput,
  t: (key: any, vars?: any) => string,
  isEdit = false,
  initialNotes?: string | null
): SubscriptionValidationResult {
  const errors: Record<string, string> = {};

  // 1. Name validation
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    errors.name = t('subscriptions.validation.nameRequired');
  }

  // 2. Amount validation (strictly positive)
  const amountRes = parseSubscriptionAmount(input.amountStr);
  if (amountRes.errorKey) {
    errors.amount = t(amountRes.errorKey);
  }

  // 3. Billing day validation (1-28)
  const billingDayRes = parseLocalizedBillingDay(input.billingDayStr, true);
  if (billingDayRes.errorKey || billingDayRes.value == null) {
    errors.billingDay = t('subscriptions.validation.billingDayInvalid');
  }

  // 4. Honest guard for notes clearing:
  // Backend ignores undefined/empty string updates, preserving previous note in DB.
  const trimmedNotes = input.notes.trim();
  if (isEdit && initialNotes && initialNotes.trim().length > 0 && trimmedNotes.length === 0) {
    errors.notes = t('subscriptions.validation.cannotClearNotes');
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const rawPayload = {
    name: trimmedName,
    amount: amountRes.value,
    cycle: input.cycle,
    billingCycle: input.cycle,
    billingDay: billingDayRes.value!,
    nextBillingDate: formatCalendarDate(input.nextBillingDate),
    status: input.status,
    notes: trimmedNotes || undefined,
  };

  const schemaResult = SubscriptionSchema.safeParse(rawPayload);
  if (!schemaResult.success) {
    const zodKeys = mapZodErrorToKeys(schemaResult.error);
    const translatedErrors: Record<string, string> = {};
    for (const [key, errKey] of Object.entries(zodKeys)) {
      translatedErrors[key] = t(errKey as any);
    }
    return { valid: false, errors: translatedErrors };
  }

  return {
    valid: true,
    errors: {},
    payload: rawPayload,
  };
}
