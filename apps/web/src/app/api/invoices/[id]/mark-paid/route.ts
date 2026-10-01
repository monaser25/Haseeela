import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { withApiError, HttpError } from '@/server/errors';
import { prisma } from '@/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async (request: Request, { params }: { params: { id: string } }) =>
  withApiError(request, async () => {
    const user = await authenticateRequest(request);
    const userId = getUserId(user);

    const existing = await prisma.invoice.findFirst({ where: { id: params.id, userId } });
    if (!existing) throw new HttpError(404, 'Invoice not found');
    if (existing.status === 'PAID') {
      const full = await prisma.invoice.findUnique({
        where: { id: existing.id },
        include: { lineItems: { orderBy: { position: 'asc' } }, client: { select: { id: true, name: true, company: true, email: true } } },
      });
      return NextResponse.json({ invoice: full, transaction: null });
    }

    const paidAt = new Date();

    const claimResult = await prisma.$transaction(async (tx) => {
      // Conditional claim: update status to PAID only if it is not already PAID
      const claimed = await tx.invoice.updateMany({
        where: {
          id: params.id,
          userId,
          status: { not: 'PAID' },
        },
        data: {
          status: 'PAID',
          paidAt,
        },
      });

      if (claimed.count === 0) {
        // Concurrency loser: another request already claimed payment
        return { isWinner: false };
      }

      // Authoritative read under the protected transaction to ensure fresh total and client
      const freshInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: params.id },
      });

      const transaction = await tx.transaction.create({
        data: {
          name: `Payment — ${freshInvoice.number}`,
          amount: freshInvoice.total,
          type: 'INCOME',
          status: 'COMPLETED',
          date: paidAt,
          notes: null,
          sourceType: 'invoice',
          sourceId: freshInvoice.id,
          categoryId: 'CLIENT',
          clientId: freshInvoice.clientId,
          isAuto: true,
          userId,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: freshInvoice.id },
        data: { transactionId: transaction.id },
        include: {
          lineItems: { orderBy: { position: 'asc' } },
          client: { select: { id: true, name: true, company: true, email: true } },
        },
      });

      return { isWinner: true, invoice: updatedInvoice, transaction };
    });

    if (!claimResult.isWinner) {
      // Re-read authoritative row and return idempotent result without income
      const full = await prisma.invoice.findUnique({
        where: { id: params.id },
        include: {
          lineItems: { orderBy: { position: 'asc' } },
          client: { select: { id: true, name: true, company: true, email: true } },
        },
      });
      return NextResponse.json({ invoice: full, transaction: null });
    }

    // Best-effort notification — only sent for the actual winning payment
    await prisma.notification
      .create({
        data: {
          type: 'PAYMENT_RECORDED',
          title: `Payment recorded for ${claimResult.invoice!.number}`,
          body: `Marked ${claimResult.invoice!.number} as paid.`,
          link: '/invoices',
          refKey: `invoice-paid:${claimResult.invoice!.id}`,
          userId,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({
      invoice: claimResult.invoice,
      transaction: claimResult.transaction,
    });
  });

