import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { generateNotifications } from '@/server/notifications';
import { RECURRING_TRANSACTION_OPTIONS, runDueRecurringPaymentsInTransaction } from '@/server/recurring-billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily maintenance: post due recurring payments and generate reminder
// notifications for every user. Triggered by Vercel Cron (see vercel.json).
const authorize = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization');
    if (header === `Bearer ${secret}`) return true;
    if (new URL(request.url).searchParams.get('secret') === secret) return true;
    return false;
  }
  // No secret configured: only allow Vercel's own cron invocations.
  return request.headers.get('x-vercel-cron') != null;
};

export const GET = async (request: Request) => withApiError(request, async () => {
  if (!authorize(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = await prisma.user.findMany({ select: { id: true } });
  const now = new Date();
  let processed = 0;

  for (const { id: userId } of users) {
    try {
      await prisma.$transaction(async (tx) => {
        await runDueRecurringPaymentsInTransaction(tx, userId, now);
      }, RECURRING_TRANSACTION_OPTIONS);
      await generateNotifications(userId);
      processed += 1;
    } catch (err) {
      console.error(`Cron failed for user ${userId}`, err);
    }
  }

  return NextResponse.json({ ok: true, users: users.length, processed });
});
