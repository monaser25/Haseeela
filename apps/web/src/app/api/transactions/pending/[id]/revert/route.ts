import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { revertPendingPayment } from '@/server/recurring-billing';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export const POST = async (request: Request, { params }: RouteContext) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);

  const transaction = await prisma.$transaction((tx) => revertPendingPayment(tx, userId, params.id));
  return NextResponse.json(transaction, { status: 200 });
});
