import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { getSupabaseAuthClient } from './supabase';
import { HttpError } from './errors';

export const MAX_DELETION_ATTEMPTS = 5;
export const LEASE_DURATION_MS = 60_000;

export type PersistedDeletionErrorCode =
  | 'AUTH_DELETE_FAILED'
  | 'FINANCE_CLEANUP_FAILED'
  | 'MAX_RETRIES_EXCEEDED';

export type ApiDeletionErrorCode =
  | PersistedDeletionErrorCode
  | 'PERSISTENCE_FAILED'
  | 'CLAIM_EXPIRED';

export class AccountDeletionError extends HttpError {
  code: ApiDeletionErrorCode | string;
  deletionPending: boolean;

  constructor(statusCode: number, message: string, code: ApiDeletionErrorCode | string, deletionPending: boolean) {
    super(statusCode, message);
    Object.setPrototypeOf(this, AccountDeletionError.prototype);
    this.code = code;
    this.deletionPending = deletionPending;
  }
}

export const isUserNotFoundError = async (error: unknown, userId: string): Promise<boolean> => {
  if (error && typeof error === 'object') {
    const err = error as { code?: string };
    if (err.code === 'user_not_found') {
      return true;
    }
  }

  try {
    const { data, error: getErr } = await getSupabaseAuthClient().auth.admin.getUserById(userId);
    if (getErr && typeof getErr === 'object' && (getErr as { code?: string }).code === 'user_not_found') {
      return true;
    }
    if (data && data.user) {
      return false;
    }
  } catch {
    return false;
  }

  return false;
};

export const deleteSupabaseAuthUser = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await getSupabaseAuthClient().auth.admin.deleteUser(userId);
    if (error) {
      if (await isUserNotFoundError(error, userId)) {
        return true;
      }
      throw error;
    }
    return true;
  } catch (err) {
    if (await isUserNotFoundError(err, userId)) {
      return true;
    }
    throw err;
  }
};

export const acquireDeletionClaim = async (
  userId: string,
  ownerToken: string,
  options?: { maxAttempts?: number },
): Promise<boolean> => {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

  const whereClause: any = {
    userId,
    status: { not: 'COMPLETED' },
    OR: [
      { ownerToken: null },
      { leaseExpiresAt: null },
      { leaseExpiresAt: { lt: now } },
      { ownerToken },
    ],
  };

  if (options?.maxAttempts !== undefined) {
    whereClause.attempts = { lt: options.maxAttempts };
  }

  const claimed = await prisma.accountDeletion.updateMany({
    where: whereClause,
    data: {
      ownerToken,
      leaseExpiresAt,
    },
  });

  return claimed.count > 0;
};

/**
 * Fenced scoped financial cleanup and COMPLETED commit inside a single transaction.
 * A conditional write fence on AccountDeletion acquires row write lock and verifies
 * that this worker still holds an active, unexpired lease in AUTH_DELETED phase.
 */
export const executeFencedFinancialCleanupTransaction = async (
  db: PrismaClient,
  userId: string,
  ownerToken: string,
): Promise<{ ok: boolean }> => {
  return await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const now = new Date();
    const renewedLease = new Date(now.getTime() + LEASE_DURATION_MS);

    const fence = await tx.accountDeletion.updateMany({
      where: {
        userId,
        ownerToken,
        status: 'AUTH_DELETED',
        leaseExpiresAt: { gt: now },
      },
      data: {
        leaseExpiresAt: renewedLease,
      },
    });

    if (fence.count === 0) {
      const current = await tx.accountDeletion.findUnique({ where: { userId } });
      if (current?.status === 'COMPLETED') {
        return { ok: true };
      }
      throw new AccountDeletionError(409, 'Lost ownership fence prior to financial cleanup', 'CLAIM_EXPIRED', true);
    }

    await tx.notification.deleteMany({ where: { userId } });

    const userInvoices = await tx.invoice.findMany({
      where: { userId },
      select: { id: true },
    });
    if (userInvoices.length > 0) {
      const invoiceIds = userInvoices.map((inv) => inv.id);
      await tx.invoiceLineItem.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
    }

    await tx.invoice.deleteMany({ where: { userId } });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.budget.deleteMany({ where: { userId } });
    await tx.subscription.deleteMany({ where: { userId } });
    await tx.client.deleteMany({ where: { userId } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.auditLog.deleteMany({ where: { userId } });
    await tx.user.deleteMany({ where: { id: userId } });

    const commit = await tx.accountDeletion.updateMany({
      where: {
        userId,
        ownerToken,
        status: 'AUTH_DELETED',
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastErrorCode: null,
        ownerToken: null,
        leaseExpiresAt: null,
      },
    });

    if (commit.count === 0) {
      const current = await tx.accountDeletion.findUnique({ where: { userId } });
      if (current?.status === 'COMPLETED') {
        return { ok: true };
      }
      throw new AccountDeletionError(409, 'Failed to commit deletion completion within transaction', 'CLAIM_EXPIRED', true);
    }

    return { ok: true };
  });
};

/**
 * Shared monotonic runner for both client DELETE endpoint and cron background retry.
 */
export const executeAccountDeletionWorkflow = async (
  userId: string,
  options?: { isDevUser?: boolean; caller?: 'delete' | 'cron'; maxAttempts?: number },
): Promise<{ ok: boolean }> => {
  const isDevUser = Boolean(options?.isDevUser);
  const caller = options?.caller || 'delete';
  const effectiveMaxAttempts = options?.maxAttempts ?? MAX_DELETION_ATTEMPTS;
  const ownerToken = crypto.randomUUID();

  // 1. Authoritative durable intent registration or verification
  let record = await prisma.accountDeletion.findUnique({ where: { userId } });
  if (!record && caller === 'delete') {
    try {
      record = await prisma.accountDeletion.create({
        data: {
          userId,
          status: 'PENDING',
          isDev: isDevUser,
          ownerToken: null,
          leaseExpiresAt: null,
        },
      });
    } catch (createErr) {
      if (createErr instanceof Prisma.PrismaClientKnownRequestError && createErr.code === 'P2002') {
        record = await prisma.accountDeletion.findUnique({ where: { userId } });
      } else {
        throw new AccountDeletionError(500, 'Failed to record account deletion intent', 'PERSISTENCE_FAILED', false);
      }
    }
  }

  if (!record) {
    throw new AccountDeletionError(500, 'Failed to locate durable account deletion intent', 'PERSISTENCE_FAILED', false);
  }

  if (record.status === 'COMPLETED') {
    return { ok: true };
  }

  // 2. Claim / Lease acquisition (cron fences attempts cap on authoritative DB state; delete does not)
  const claimOptions = caller === 'cron' ? { maxAttempts: effectiveMaxAttempts } : undefined;
  let hasClaim = await acquireDeletionClaim(userId, ownerToken, claimOptions);
  if (!hasClaim) {
    if (caller === 'delete') {
      for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const check = await prisma.accountDeletion.findUnique({ where: { userId } });
        if (check?.status === 'COMPLETED') {
          return { ok: true };
        }
        hasClaim = await acquireDeletionClaim(userId, ownerToken);
        if (hasClaim) break;
      }
    }

    if (!hasClaim) {
      const check = await prisma.accountDeletion.findUnique({ where: { userId } });
      if (check?.status === 'COMPLETED') {
        return { ok: true };
      }
      throw new AccountDeletionError(409, 'Account deletion in progress by another worker', 'CLAIM_EXPIRED', true);
    }
  }

  // Authoritatively re-read fresh row after claim acquisition
  record = await prisma.accountDeletion.findUnique({ where: { userId } });
  if (!record) {
    throw new AccountDeletionError(500, 'Account deletion intent absent after acquiring claim', 'PERSISTENCE_FAILED', false);
  }
  if (record.status === 'COMPLETED') {
    return { ok: true };
  }
  if (caller === 'cron' && record.attempts >= effectiveMaxAttempts) {
    return { ok: false };
  }
  if (record.ownerToken !== ownerToken) {
    throw new AccountDeletionError(409, 'Lost ownership claim during account deletion', 'CLAIM_EXPIRED', true);
  }

  // 3. Phase 1: External Auth Removal (if PENDING)
  if (record.status === 'PENDING') {
    if (record.isDev) {
      const advanced = await prisma.accountDeletion.updateMany({
        where: { userId, ownerToken, status: 'PENDING' },
        data: { status: 'AUTH_DELETED', lastErrorCode: null },
      });
      if (advanced.count === 0) {
        const check = await prisma.accountDeletion.findUnique({ where: { userId } });
        if (check?.status === 'COMPLETED') return { ok: true };
        throw new AccountDeletionError(409, 'Lost ownership claim during account deletion', 'CLAIM_EXPIRED', true);
      }
    } else {
      try {
        await deleteSupabaseAuthUser(userId);
        const advanced = await prisma.accountDeletion.updateMany({
          where: { userId, ownerToken, status: 'PENDING' },
          data: { status: 'AUTH_DELETED', lastErrorCode: null },
        });
        if (advanced.count === 0) {
          const check = await prisma.accountDeletion.findUnique({ where: { userId } });
          if (check?.status === 'COMPLETED') return { ok: true };
          throw new AccountDeletionError(409, 'Lost ownership claim during account deletion', 'CLAIM_EXPIRED', true);
        }
      } catch (authErr: unknown) {
        if (authErr instanceof AccountDeletionError) {
          throw authErr;
        }

        // If another runner completed deletion while this call was in flight, return success
        const check = await prisma.accountDeletion.findUnique({ where: { userId } }).catch(() => null);
        if (check?.status === 'COMPLETED') {
          return { ok: true };
        }

        const nextAttempts = (record.attempts || 0) + 1;
        const lastErrorCode: PersistedDeletionErrorCode =
          nextAttempts >= effectiveMaxAttempts ? 'MAX_RETRIES_EXCEEDED' : 'AUTH_DELETE_FAILED';

        await prisma.accountDeletion.updateMany({
          where: { userId, ownerToken, status: 'PENDING' },
          data: {
            attempts: { increment: 1 },
            lastErrorCode,
            leaseExpiresAt: null,
          },
        }).catch(() => {});
        throw new AccountDeletionError(502, 'Failed to delete authentication account', 'AUTH_DELETE_FAILED', true);
      }
    }
  }

  // 4. Verify AUTH_DELETED status before entering finance fence
  const preCleanupRecord = await prisma.accountDeletion.findUnique({ where: { userId } });
  if (preCleanupRecord?.status === 'COMPLETED') {
    return { ok: true };
  }
  if (preCleanupRecord?.status !== 'AUTH_DELETED') {
    throw new AccountDeletionError(409, 'Cannot perform financial cleanup without confirmed auth removal', 'CLAIM_EXPIRED', true);
  }

  // 5. Phase 2: Atomic Fenced Scoped Financial Cleanup + COMPLETED commit
  try {
    return await executeFencedFinancialCleanupTransaction(prisma, userId, ownerToken);
  } catch (txErr: unknown) {
    if (txErr instanceof AccountDeletionError) {
      throw txErr;
    }

    const check = await prisma.accountDeletion.findUnique({ where: { userId } }).catch(() => null);
    if (check?.status === 'COMPLETED') {
      return { ok: true };
    }

    const nextAttempts = (record.attempts || 0) + 1;
    const lastErrorCode: PersistedDeletionErrorCode =
      nextAttempts >= effectiveMaxAttempts ? 'MAX_RETRIES_EXCEEDED' : 'FINANCE_CLEANUP_FAILED';

    await prisma.accountDeletion.updateMany({
      where: { userId, ownerToken, status: 'AUTH_DELETED' },
      data: {
        attempts: { increment: 1 },
        lastErrorCode,
        leaseExpiresAt: null,
      },
    }).catch(() => {});
    throw new AccountDeletionError(500, 'Failed to clean up account data', 'FINANCE_CLEANUP_FAILED', true);
  }
};

export const processAccountDeletion = async (
  userId: string,
  isDevUser: boolean,
): Promise<{ ok: boolean }> => {
  return await executeAccountDeletionWorkflow(userId, { isDevUser, caller: 'delete' });
};

export const retryPendingDeletions = async (
  limit = 20,
  maxAttempts = MAX_DELETION_ATTEMPTS,
): Promise<{ processed: number; failed: number }> => {
  const now = new Date();
  let pendingJobs: { userId: string }[] = [];
  try {
    pendingJobs = await prisma.accountDeletion.findMany({
      where: {
        status: { in: ['PENDING', 'AUTH_DELETED'] },
        attempts: { lt: maxAttempts },
        OR: [
          { ownerToken: null },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { userId: true },
    });
  } catch {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    try {
      const fresh = await prisma.accountDeletion.findUnique({ where: { userId: job.userId } });
      if (!fresh || fresh.status === 'COMPLETED' || fresh.attempts >= maxAttempts) {
        if (fresh?.status === 'COMPLETED') processed += 1;
        continue;
      }

      const result = await executeAccountDeletionWorkflow(job.userId, { caller: 'cron', maxAttempts });
      if (result.ok) {
        processed += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { processed, failed };
};
