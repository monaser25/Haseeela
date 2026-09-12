import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { createPendingPayment } from '@/server/recurring-billing';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { pendingPaymentCreateSchema } from '@/server/validation';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);
  const body = await request.json().catch(() => ({}));
  const validated = pendingPaymentCreateSchema.parse(body);

  const transaction = await prisma.$transaction((tx) => createPendingPayment(tx, userId, validated));
  return NextResponse.json(transaction, { status: 201 });
});
