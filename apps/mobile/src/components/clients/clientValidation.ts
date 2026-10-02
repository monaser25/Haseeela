import { ClientSchema, pendingPaymentCreateSchema } from '@haseela/shared';
import type { ZodError } from 'zod';
import { parseLocaleAmount } from '../transactions/parseAmount';
import { formatCalendarDate } from '../../utils/calendarDate';

/**
 * Normalizes Arabic-Indic (U+0660..U+0669) and Persian (U+06F0..U+06F9) digits to standard ASCII digits.
 */
export function normalizeDigits(input: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  let result = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const arIndex = arabicDigits.indexOf(char);
    if (arIndex !== -1) {
      result += String(arIndex);
      continue;
    }
    const faIndex = persianDigits.indexOf(char);
    if (faIndex !== -1) {
      result += String(faIndex);
      continue;
    }
    result += char;
  }
  return result;
}

/**
 * Parses and strictly validates a localized billing day string (1–28).
 * Supports Arabic, Persian, and ASCII digits.
 * Rejects truncation (e.g. '12abc', '12.5'), negatives, and out-of-range values.
 * If required is true and input is blank, returns errorKey.
 */
export function parseLocalizedBillingDay(
  input: string | null | undefined,
  required = false
): { value?: number; errorKey?: string } {
  if (input == null || !input.trim()) {
    if (required) {
      return { errorKey: 'clients.validation.billingDayInvalid' };
    }
    return {};
  }

  const normalized = normalizeDigits(input.trim());

  // Must consist solely of 1 or 2 digits with no decimals, letters, or signs
  if (!/^\d{1,2}$/.test(normalized)) {
    return { errorKey: 'clients.validation.billingDayInvalid' };
  }

  const num = Number(normalized);
  if (!Number.isInteger(num) || num < 1 || num > 28) {
    return { errorKey: 'clients.validation.billingDayInvalid' };
  }

  return { value: num };
}

/**
 * Strictly parses client revenue amount.
 * - Blank input is treated as 0 (allowed by ClientSchema default).
 * - Non-empty malformed (e.g. 'abc', '1,2,3', 'Infinity') or negative is strictly rejected.
 */
export function parseClientRevenue(
  input: string | null | undefined
): { value: number; isBlank: boolean; errorKey?: string } {
  if (input == null) return { value: 0, isBlank: true };
  const trimmed = input.trim();
  if (!trimmed) return { value: 0, isBlank: true };

  const parsed = parseLocaleAmount(trimmed);

  if (isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return { value: NaN, isBlank: false, errorKey: 'clients.validation.amountInvalid' };
  }

  return { value: parsed, isBlank: false };
}

/**
 * Maps Zod validation errors to localized message keys across all fields.
 * Prevents exposing raw English Zod messages to users.
 */
export function mapZodErrorToKeys(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  error.errors.forEach((err) => {
    const field = err.path[0]?.toString();
    if (!field || result[field]) return;

    switch (field) {
      case 'name':
        result[field] = 'clients.validation.nameRequired';
        break;
      case 'email':
        result[field] = 'clients.validation.emailInvalid';
        break;
      case 'revenue':
      case 'amount':
        result[field] = 'clients.validation.amountInvalid';
        break;
      case 'billingDay':
        result[field] = 'clients.validation.billingDayInvalid';
        break;
      default:
        result[field] = 'clients.error.generic';
        break;
    }
  });
  return result;
}

export interface ClientFormInputValues {
  name: string;
  revenueStr: string;
  company: string;
  email: string;
  clientType: 'COMPANY' | 'INDIVIDUAL';
  status: 'ACTIVE' | 'PROSPECT' | 'COMPLETED' | 'INACTIVE';
  paymentType: 'onetime' | 'retainer';
  paymentDate: Date;
  billingDayStr: string;
  nextBillingDate: Date;
  existingClient?: {
    company?: string | null;
    email?: string | null;
  };
}

export interface ValidationOutcome {
  valid: boolean;
  errors: Record<string, string>;
  payload?: {
    name: string;
    revenue: number;
    company?: string;
    email?: string;
    clientType: 'COMPANY' | 'INDIVIDUAL';
    status: 'ACTIVE' | 'PROSPECT' | 'COMPLETED' | 'INACTIVE';
    paymentType: 'onetime' | 'retainer';
    paymentDate?: string;
    billingDay?: number;
    nextBillingDate?: string;
  };
}

/**
 * Centralized, typed validation for client forms (create and edit).
 * Maps all validation failures to localized translation keys and guards optional field clears.
 */
export function validateClientFormInput(
  values: ClientFormInputValues,
  t: (key: any) => string,
  isEdit = false
): ValidationOutcome {
  const errors: Record<string, string> = {};

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = t('clients.validation.nameRequired');
  }

  const revenueResult = parseClientRevenue(values.revenueStr);
  if (revenueResult.errorKey) {
    errors.revenue = t(revenueResult.errorKey);
  }

  const isRetainer = values.paymentType === 'retainer';
  let parsedBillingDay: number | undefined;

  if (isRetainer) {
    const billingDayResult = parseLocalizedBillingDay(values.billingDayStr, true);
    if (billingDayResult.errorKey) {
      errors.billingDay = t(billingDayResult.errorKey);
    } else {
      parsedBillingDay = billingDayResult.value;
    }
  }

  const trimmedCompany = values.company.trim();
  const trimmedEmail = values.email.trim();

  // Guard against backend gap: prevent clearing existing non-empty optional fields on edit
  if (isEdit && values.existingClient) {
    if (values.existingClient.company && values.existingClient.company.trim() && !trimmedCompany) {
      errors.company = t('clients.validation.cannotClearCompany');
    }
    if (values.existingClient.email && values.existingClient.email.trim() && !trimmedEmail) {
      errors.email = t('clients.validation.cannotClearEmail');
    }
  }

  // Pre-validate with shared ClientSchema / ClientSchema.partial()
  const candidate = {
    name: trimmedName,
    revenue: isNaN(revenueResult.value) ? 0 : revenueResult.value,
    company: trimmedCompany || undefined,
    email: trimmedEmail || undefined,
    clientType: values.clientType,
    status: values.status,
    paymentType: values.paymentType,
    paymentDate: values.paymentType === 'onetime' ? formatCalendarDate(values.paymentDate) : undefined,
    billingDay: parsedBillingDay,
    nextBillingDate: isRetainer ? formatCalendarDate(values.nextBillingDate) : undefined,
  };

  const schemaResult = isEdit
    ? ClientSchema.partial().safeParse(candidate)
    : ClientSchema.safeParse(candidate);

  if (!schemaResult.success) {
    const zodKeyMap = mapZodErrorToKeys(schemaResult.error);
    for (const [field, key] of Object.entries(zodKeyMap)) {
      if (!errors[field]) {
        errors[field] = t(key);
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    payload: candidate,
  };
}
