import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { updatePendingPayment, deletePendingPayment } from '@/server/recurring-billing';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { pendingPaymentUpdateSchema } from '@/server/validation';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export const PATCH = async (request: Request, { params }: RouteContext) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);
  const body = await request.json().catch(() => ({}));
  const validated = pendingPaymentUpdateSchema.parse(body);

  const transaction = await prisma.$transaction((tx) => updatePendingPayment(tx, userId, params.id, validated));
  return NextResponse.json(transaction, { status: 200 });
});

export const DELETE = async (request: Request, { params }: RouteContext) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);

  const result = await prisma.$transaction((tx) => deletePendingPayment(tx, userId, params.id));
  return NextResponse.json(result, { status: 200 });
});
