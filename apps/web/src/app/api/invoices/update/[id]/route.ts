import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { withApiError, HttpError } from '@/server/errors';
import { toDate } from '@/server/recurring-billing';
import { prisma } from '@/server/prisma';
import { InvoiceSchema } from '@/server/validation';
import { computeInvoiceTotals } from '@/server/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = async (request: Request, { params }: { params: { id: string } }) =>
  withApiError(request, async () => {
    const user = await authenticateRequest(request);
    const userId = getUserId(user);
    const data = InvoiceSchema.parse(await request.json());

    const existing = await prisma.invoice.findFirst({ where: { id: params.id, userId } });
    if (!existing) throw new HttpError(404, 'Invoice not found');

    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, userId },
        select: { id: true },
      });
      if (!client) {
        throw new HttpError(404, 'Client not found');
      }
    }

    const { items, subtotal, taxAmount, total } = computeInvoiceTotals(data.lineItems, data.taxRate, data.discount);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: params.id } });
      return tx.invoice.update({
        where: { id: params.id },
        data: {
          number: data.number?.trim() || existing.number,
          clientId: data.clientId || null,
          issueDate: toDate(data.issueDate)!,
          dueDate: toDate(data.dueDate)!,
          status: data.status,
          currency: data.currency,
          subtotal,
          taxRate: data.taxRate,
          taxAmount,
          discount: data.discount,
          total,
          notes: data.notes || null,
          terms: data.terms || null,
          sentAt: data.status === 'SENT' && !existing.sentAt ? new Date() : existing.sentAt,
          lineItems: { create: items },
        },
        include: {
          lineItems: { orderBy: { position: 'asc' } },
          client: { select: { id: true, name: true, company: true, email: true } },
        },
      });
    });

    return NextResponse.json(invoice);
  });
