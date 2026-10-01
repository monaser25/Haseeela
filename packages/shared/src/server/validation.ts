import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional(),
);

const dateString = z.string().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

const optionalDateString = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  dateString.optional(),
);

const optionalEmail = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().email().optional(),
);

const optionalBillingDay = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().int().min(1).max(28).optional(),
);

const billingDay = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().int().min(1).max(28).default(1),
);

const sourceTypeSchema = z.enum(['manual', 'client', 'client-payment', 'subscription']).transform((value) => (
  value === 'client-payment' ? 'client' : value
));

export const ClientSchema = z.object({
  name: z.string().trim().min(1),
  email: optionalEmail,
  company: optionalString,
  revenue: z.coerce.number().nonnegative().default(0),
  clientType: z.enum(['INDIVIDUAL', 'COMPANY']).default('COMPANY'),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PROSPECT', 'INACTIVE']).default('ACTIVE'),
  paymentType: z.enum(['onetime', 'retainer']).default('onetime'),
  paymentDate: optionalDateString,
  billingDay: optionalBillingDay,
  nextBillingDate: optionalDateString,
  recorded: z.boolean().optional(),
  transactionId: optionalString,
  archivedAt: optionalDateString,
});

export const SubscriptionSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  notes: optionalString,
  billingDay,
  nextBillingDate: dateString,
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  transactionId: optionalString,
  archivedAt: optionalDateString,
});

export const InvoiceLineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().nonnegative().default(1),
  rate: z.coerce.number().default(0),
});

export const InvoiceSchema = z.object({
  number: optionalString,
  clientId: optionalString,
  issueDate: dateString,
  dueDate: dateString,
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE']).default('DRAFT'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED']).default('USD'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).default(0),
  notes: optionalString,
  terms: optionalString,
  lineItems: z.array(InvoiceLineItemSchema).min(1, 'Add at least one line item'),
});

export const TransactionSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  type: z.enum(['INCOME', 'EXPENSE']),
  status: z.enum(['COMPLETED', 'PENDING']).default('COMPLETED'),
  date: dateString,
  notes: optionalString,
  sourceType: sourceTypeSchema,
  sourceId: optionalString,
  clientId: optionalString,
  subscriptionId: optionalString,
  sourceBillingDate: optionalDateString,
  categoryId: z.string().min(1),
  isAuto: z.boolean().optional(),
  isEdited: z.boolean().optional(),
});

const optionalNote = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().max(500, 'Note cannot exceed 500 characters').optional(),
);

export const pendingPaymentCreateSchema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  expectedDate: dateString,
  note: optionalNote,
});

export const pendingPaymentUpdateSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive').optional(),
  expectedDate: optionalDateString,
  note: optionalNote,
}).refine(
  (data) => data.amount !== undefined || data.expectedDate !== undefined || data.note !== undefined,
  { message: 'At least one field must be provided' },
);

export const pendingPaymentCompleteSchema = z.object({
  completedDate: optionalDateString,
});
