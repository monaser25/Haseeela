import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { completePendingPayment } from '@/server/recurring-billing';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { pendingPaymentCompleteSchema } from '@/server/validation';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export const POST = async (request: Request, { params }: RouteContext) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);
  const body = await request.json().catch(() => ({}));
  const validated = pendingPaymentCompleteSchema.parse(body);

  const transaction = await prisma.$transaction((tx) => completePendingPayment(tx, userId, params.id, validated.completedDate));
  return NextResponse.json(transaction, { status: 200 });
});
