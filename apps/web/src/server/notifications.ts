import { formatDate } from '@/lib/format';
import { DEFAULT_LOCALE } from '@/lib/locales';
import { prisma } from '@/server/prisma';
import { t } from '@/messages';
import { sendPushToUser, type PushMessage } from '@/server/push';

const DAY = 24 * 60 * 60 * 1000;
const fmtDate = (d: Date) => formatDate(d, DEFAULT_LOCALE, { month: 'short', day: 'numeric' });

/**
 * Compute reminder notifications from the user's current data and insert any
 * that don't already exist (deduped via the unique (userId, refKey) index).
 * Idempotent — safe to call on every notifications load and from a cron job.
 * With `sendPush` (cron only), newly-created notifications also trigger one
 * best-effort push to the user's devices; failures never affect the result.
 */
export const generateNotifications = async (userId: string, options: { sendPush?: boolean } = {}) => {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * DAY);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyBillingReminders: true, notifyInvoiceDue: true },
  });

  const wantBilling = user?.notifyBillingReminders ?? true;
  const wantInvoice = user?.notifyInvoiceDue ?? true;

  const pending: { type: string; title: string; body?: string; link?: string; refKey: string; userId: string }[] = [];
  const invoiceIds = new Map<string, string>(); // refKey -> invoice id (for push deep links)

  if (wantBilling) {
    const subs = await prisma.subscription.findMany({
      where: { userId, status: 'ACTIVE', archivedAt: null, nextBillingDate: { lte: soon } },
    });
    for (const s of subs) {
      const due = new Date(s.nextBillingDate);
      pending.push({
        type: 'BILLING_DUE',
        title: t(DEFAULT_LOCALE, 'notifications.msg.subRenewsTitle', { name: s.name, date: fmtDate(due) }),
        body: t(DEFAULT_LOCALE, 'notifications.msg.subRenewsBody'),
        link: '/subscriptions',
        refKey: `billing-sub:${s.id}:${due.toISOString().slice(0, 10)}`,
        userId,
      });
    }

    const clients = await prisma.client.findMany({
      where: { userId, status: 'ACTIVE', archivedAt: null, paymentType: 'retainer', nextBillingDate: { lte: soon, not: null } },
    });
    for (const c of clients) {
      if (!c.nextBillingDate) continue;
      const due = new Date(c.nextBillingDate);
      pending.push({
        type: 'BILLING_DUE',
        title: t(DEFAULT_LOCALE, 'notifications.msg.clientDueTitle', { name: c.name, date: fmtDate(due) }),
        body: t(DEFAULT_LOCALE, 'notifications.msg.clientDueBody'),
        link: '/clients',
        refKey: `billing-client:${c.id}:${due.toISOString().slice(0, 10)}`,
        userId,
      });
    }
  }

  if (wantInvoice) {
    const invoices = await prisma.invoice.findMany({
      where: { userId, status: 'SENT', dueDate: { lt: now } },
    });
    for (const inv of invoices) {
      pending.push({
        type: 'INVOICE_OVERDUE',
        title: t(DEFAULT_LOCALE, 'notifications.msg.invoiceOverdueTitle', { number: inv.number }),
        body: t(DEFAULT_LOCALE, 'notifications.msg.invoiceOverdueBody', { date: fmtDate(new Date(inv.dueDate)) }),
        link: '/invoices',
        refKey: `invoice-overdue:${inv.id}`,
        userId,
      });
      invoiceIds.set(`invoice-overdue:${inv.id}`, inv.id);
    }
  }

  if (pending.length === 0) return;

  // Only notifications that did not exist before this call are push-worthy.
  let fresh: typeof pending = [];
  if (options.sendPush) {
    try {
      const existing = await prisma.notification.findMany({
        where: { userId, refKey: { in: pending.map((p) => p.refKey) } },
        select: { refKey: true },
      });
      const known = new Set(existing.map((e) => e.refKey));
      fresh = pending.filter((p) => !known.has(p.refKey));
    } catch {
      fresh = [];
    }
  }

  await prisma.notification.createMany({ data: pending, skipDuplicates: true });

  if (fresh.length > 0) {
    try {
      await sendPushToUser(userId, buildPushMessage(fresh, invoiceIds));
    } catch {
      console.error('Push notification dispatch failed');
    }
  }
};

// One push per user per run: a single overdue invoice deep-links to it, anything
// else lands on the notifications list. Contains no user data.
const buildPushMessage = (
  fresh: { type: string; refKey: string }[],
  invoiceIds: Map<string, string>,
): PushMessage => {
  if (fresh.length === 1) {
    const only = fresh[0];
    const invoiceId = invoiceIds.get(only.refKey);
    if (only.type === 'INVOICE_OVERDUE' && invoiceId) {
      return { kind: 'invoice_overdue', route: '/(app)/invoice/[id]', params: { id: invoiceId } };
    }
    if (only.refKey.startsWith('billing-sub:')) {
      return { kind: 'billing_due', route: '/(app)/subscriptions' };
    }
  }
  const allBilling = fresh.every((f) => f.type === 'BILLING_DUE');
  const allInvoice = fresh.every((f) => f.type === 'INVOICE_OVERDUE');
  return {
    kind: allBilling ? 'billing_due' : allInvoice ? 'invoice_overdue' : 'reminders',
    route: '/(app)/notifications',
  };
};
