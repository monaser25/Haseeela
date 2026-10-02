import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { RECURRING_TRANSACTION_OPTIONS, runDueRecurringPaymentsInTransaction } from '@/server/recurring-billing';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);

  const { clients, subscriptions, transactions } = await prisma.$transaction(async (tx) => {
    await runDueRecurringPaymentsInTransaction(tx, userId, new Date());

    const [nextClients, nextSubscriptions, nextTransactions] = await Promise.all([
      tx.client.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      tx.subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      tx.transaction.findMany({
        where: { userId, deletedAt: null },
        orderBy: { date: 'desc' },
      }),
    ]);

    return {
      clients: nextClients,
      subscriptions: nextSubscriptions,
      transactions: nextTransactions,
    };
  }, RECURRING_TRANSACTION_OPTIONS);

  return NextResponse.json({ clients, subscriptions, transactions });
});
