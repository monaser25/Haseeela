import { NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { DEFAULT_MIN_MOBILE_VERSION } from '@haseela/shared/lib/version';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => withApiError(request, async () => {
  await prisma.$queryRaw`SELECT 1`;
  const minMobileVersion = process.env.MIN_MOBILE_VERSION?.trim() || DEFAULT_MIN_MOBILE_VERSION;
  return NextResponse.json({ status: 'ok', time: new Date(), minMobileVersion });
});
