import { Prisma } from '@prisma/client';
import { HttpError } from './errors';
import { prisma } from './prisma';

export const toDate = (value?: string | Date | null) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  return value.length === 10 ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
};

export const dateKey = (value: Date | string) => {
  const date = typeof value === 'string' ? toDate(value) : value;
  return (date || new Date()).toISOString().slice(0, 10);
};

export const todayKey = () => dateKey(new Date());

export const addMonths = (value: Date | string, months: number) => {
  const current = toDate(value) || new Date();
  const next = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + months, current.getUTCDate(), 12));
  return next;
};

export const advanceBillingDate = (value: Date | string, cycle: string) => {
  if (cycle === 'YEARLY') return addMonths(value, 12);
  if (cycle === 'QUARTERLY') return addMonths(value, 3);
  return addMonths(value, 1);
};

const generatedTransactionWhere = (userId: string, sourceType: 'client' | 'subscription', sourceId: string, billingDate: Date) => ({
  userId,
  sourceType,
  sourceId,
  OR: [
    { sourceBillingDate: billingDate },
    { date: billingDate },
  ],
});

const ensureGeneratedTransaction = async (
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    sourceType: 'client' | 'subscription';
    sourceId: string;
    sourceBillingDate: Date;
    name: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId: string;
    clientId?: string;
    subscriptionId?: string;
    status?: 'COMPLETED' | 'PENDING';
    expectedDate?: Date;
  },
) => {
  const existing = await tx.transaction.findFirst({
    where: generatedTransactionWhere(params.userId, params.sourceType, params.sourceId, params.sourceBillingDate),
  });
  if (existing) return existing;

  const status = params.status || 'COMPLETED';
  const expectedDate = params.expectedDate ?? (status === 'PENDING' ? params.sourceBillingDate : undefined);

  try {
    return await tx.transaction.create({
      data: {
        id: `auto-${params.sourceType}-${params.sourceId}-${dateKey(params.sourceBillingDate)}`,
        userId: params.userId,
        name: params.name,
        amount: params.amount,
        type: params.type,
        status,
        date: params.sourceBillingDate,
        expectedDate,
        notes: params.name,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        sourceBillingDate: params.sourceBillingDate,
        clientId: params.clientId,
        subscriptionId: params.subscriptionId,
        categoryId: params.categoryId,
        isAuto: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return tx.transaction.findFirstOrThrow({
        where: generatedTransactionWhere(params.userId, params.sourceType, params.sourceId, params.sourceBillingDate),
      });
    }
    throw err;
  }
};

export const recordClientPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string,
  today: Date | string = new Date(),
) => {
  const client = await tx.client.findFirst({ where: { id: clientId, userId, archivedAt: null } });
  if (!client) throw new HttpError(404, 'Client not found');
  if (client.paymentType !== 'retainer') throw new HttpError(400, 'Only monthly retainer clients can record recurring payments');
  if (client.status !== 'ACTIVE') throw new HttpError(400, 'Only active clients can record recurring payments');

  const billingDate = toDate(client.nextBillingDate) || toDate(today) || new Date();
  const transaction = await ensureGeneratedTransaction(tx, {
    userId,
    sourceType: 'client',
    sourceId: client.id,
    sourceBillingDate: billingDate,
    name: `${client.name} retainer payment`,
    amount: client.revenue,
    type: 'INCOME',
    categoryId: 'CLIENT',
    clientId: client.id,
  });
  const updatedClient = await tx.client.update({
    where: { id: client.id },
    data: { nextBillingDate: advanceBillingDate(billingDate, 'MONTHLY') },
  });

  return { transaction, client: updatedClient };
};

export const recordSubscriptionPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  subscriptionId: string,
  today: Date | string = new Date(),
) => {
  const subscription = await tx.subscription.findFirst({ where: { id: subscriptionId, userId, archivedAt: null } });
  if (!subscription) throw new HttpError(404, 'Subscription not found');
  if (subscription.status !== 'ACTIVE') throw new HttpError(400, 'Only active subscriptions can record payments');

  const billingDate = toDate(subscription.nextBillingDate) || toDate(today) || new Date();
  const cycle = subscription.billingCycle || subscription.cycle;
  const transaction = await ensureGeneratedTransaction(tx, {
    userId,
    sourceType: 'subscription',
    sourceId: subscription.id,
    sourceBillingDate: billingDate,
    name: `${subscription.name} subscription payment`,
    amount: subscription.amount,
    type: 'EXPENSE',
    categoryId: 'TOOLS',
    subscriptionId: subscription.id,
  });
  const updatedSubscription = await tx.subscription.update({
    where: { id: subscription.id },
    data: { nextBillingDate: advanceBillingDate(billingDate, cycle) },
  });

  return { transaction, subscription: updatedSubscription };
};

// Catching up several overdue billing periods costs a few round trips per period; Prisma's
// default 5s interactive-transaction timeout rolls the whole catch-up back on every retry.
export const RECURRING_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

export const runDueRecurringPaymentsInTransaction = async (
  tx: Prisma.TransactionClient,
  userId: string,
  today: Date | string = new Date(),
) => {
  const dueThrough = toDate(today) || new Date();
  const clients = await tx.client.findMany({
    where: {
      userId,
      paymentType: 'retainer',
      status: 'ACTIVE',
      archivedAt: null,
      nextBillingDate: { lte: dueThrough },
    },
  });
  const subscriptions = await tx.subscription.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      archivedAt: null,
      nextBillingDate: { lte: dueThrough },
    },
  });

  for (const client of clients) {
    let nextBillingDate = toDate(client.nextBillingDate) || dueThrough;
    while (nextBillingDate <= dueThrough) {
      await ensureGeneratedTransaction(tx, {
        userId,
        sourceType: 'client',
        sourceId: client.id,
        sourceBillingDate: nextBillingDate,
        name: `${client.name} retainer payment`,
        amount: client.revenue,
        type: 'INCOME',
        categoryId: 'CLIENT',
        clientId: client.id,
        status: 'PENDING',
        expectedDate: nextBillingDate,
      });
      nextBillingDate = advanceBillingDate(nextBillingDate, 'MONTHLY');
    }
    await tx.client.update({ where: { id: client.id }, data: { nextBillingDate } });
  }

  for (const subscription of subscriptions) {
    let nextBillingDate = toDate(subscription.nextBillingDate) || dueThrough;
    const cycle = subscription.billingCycle || subscription.cycle;
    while (nextBillingDate <= dueThrough) {
      await ensureGeneratedTransaction(tx, {
        userId,
        sourceType: 'subscription',
        sourceId: subscription.id,
        sourceBillingDate: nextBillingDate,
        name: `${subscription.name} subscription payment`,
        amount: subscription.amount,
        type: 'EXPENSE',
        categoryId: 'TOOLS',
        subscriptionId: subscription.id,
      });
      nextBillingDate = advanceBillingDate(nextBillingDate, cycle);
    }
    await tx.subscription.update({ where: { id: subscription.id }, data: { nextBillingDate } });
  }
};

export const runDueRecurringPayments = async (userId: string, today: Date | string = new Date()) => {
  return prisma.$transaction(
    (tx) => runDueRecurringPaymentsInTransaction(tx, userId, today),
    RECURRING_TRANSACTION_OPTIONS,
  );
};

export const createPendingPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  input: { clientId: string; amount: number; expectedDate: Date | string; note?: string },
) => {
  const client = await tx.client.findFirst({ where: { id: input.clientId, userId, archivedAt: null } });
  if (!client) throw new HttpError(404, 'Client not found');
  if (!input.amount || input.amount <= 0) throw new HttpError(400, 'Amount must be greater than 0');

  const expectedDate = toDate(input.expectedDate) || new Date();

  return tx.transaction.create({
    data: {
      userId,
      name: `${client.name} payment`,
      amount: input.amount,
      type: 'INCOME',
      status: 'PENDING',
      categoryId: 'CLIENT',
      clientId: client.id,
      sourceType: 'manual',
      date: expectedDate,
      expectedDate,
      notes: input.note,
    },
  });
};

export const updatePendingPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
  input: { amount?: number; expectedDate?: Date | string; note?: string },
) => {
  const existing = await tx.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Transaction not found');
  if (existing.status !== 'PENDING') throw new HttpError(409, 'Only pending payments can be updated');

  if (input.amount !== undefined && input.amount <= 0) {
    throw new HttpError(400, 'Amount must be greater than 0');
  }

  const expectedDate = input.expectedDate !== undefined ? toDate(input.expectedDate) : undefined;
  const data: Prisma.TransactionUpdateInput = {};
  if (input.amount !== undefined) data.amount = input.amount;
  if (expectedDate !== undefined) {
    data.expectedDate = expectedDate;
    data.date = expectedDate;
  }
  if (input.note !== undefined) data.notes = input.note;

  try {
    return await tx.transaction.update({
      where: { id },
      data,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A transaction already exists for that date');
    }
    throw err;
  }
};

export const deletePendingPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
) => {
  const existing = await tx.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Transaction not found');
  if (existing.status !== 'PENDING') throw new HttpError(409, 'Only pending payments can be deleted');

  await tx.transaction.delete({ where: { id } });
  return { success: true };
};

export const completePendingPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
  completedDate?: Date | string,
) => {
  const existing = await tx.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Transaction not found');
  if (existing.status !== 'PENDING') throw new HttpError(409, 'Payment is not pending');

  const resolvedCompletedDate = toDate(completedDate) || new Date();

  try {
    return await tx.transaction.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        date: resolvedCompletedDate,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A transaction already exists for that date');
    }
    throw err;
  }
};

export const revertPendingPayment = async (
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
) => {
  const existing = await tx.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Transaction not found');
  if (existing.status !== 'COMPLETED') throw new HttpError(409, 'Only completed transactions can be reverted');
  if (!existing.expectedDate) {
    throw new HttpError(400, 'This transaction was not created from a pending payment');
  }

  try {
    return await tx.transaction.update({
      where: { id },
      data: {
        status: 'PENDING',
        date: existing.expectedDate,
        completedAt: null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'A transaction already exists for that date');
    }
    throw err;
  }
};
