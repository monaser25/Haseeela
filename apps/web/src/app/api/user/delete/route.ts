import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { handleApiError } from '@/server/errors';
import { processAccountDeletion, AccountDeletionError } from '@/server/accountDeletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Permanently deletes the authenticated user's data and their auth account.
export const DELETE = async (request: Request) => {
  try {
    const user = await authenticateRequest(request, { allowPendingDeletion: true });
    const userId = getUserId(user);

    await processAccountDeletion(userId, Boolean(user.isDev));

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AccountDeletionError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          deletionPending: err.deletionPending,
        },
        { status: err.statusCode },
      );
    }
    return handleApiError(err, request);
  }
};


