import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { generateNotifications } from '@/server/notifications';
import { runDueRecurringPaymentsInTransaction } from '@/server/recurring-billing';
import { retryPendingDeletions } from '@/server/accountDeletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily maintenance: post due recurring payments and generate reminder
// notifications for every active user, and retry bounded durable account deletions.
const authorize = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;

  try {
    const url = new URL(request.url);
    if (url.searchParams.get('secret') === secret) return true;
  } catch {
    return false;
  }

  return false;
};

export const GET = async (request: Request) => withApiError(request, async () => {
  if (!authorize(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Process bounded durable account deletions (isolated per user/job)
  const { processed: deletionsProcessed, failed: deletionsFailed } = await retryPendingDeletions();

  // 2. Active users financial maintenance
  const users = await prisma.user.findMany({ select: { id: true } });

  // Exclude all users marked for deletion in any state
  const allDeletions = await prisma.accountDeletion.findMany({
    select: { userId: true },
  });
  const excludedUserIds = new Set(allDeletions.map((d) => d.userId));
  const activeUsers = users.filter((u) => !excludedUserIds.has(u.id));

  const now = new Date();
  let processed = 0;

  for (const { id: userId } of activeUsers) {
    try {
      await prisma.$transaction(async (tx) => {
        await runDueRecurringPaymentsInTransaction(tx, userId, now);
      });
      await generateNotifications(userId, { sendPush: true });
      processed += 1;
    } catch (err) {
      console.error(`Cron failed for user ${userId}`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    users: users.length,
    processed,
    deletionsProcessed,
    deletionsFailed,
  });
});

