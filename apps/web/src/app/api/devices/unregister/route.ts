import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { deviceUnregisterSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Deletes the token only if it belongs to the caller. Always 200 so ownership
// of other users' tokens is never revealed.
export const POST = async (request: Request) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);
  const { token } = deviceUnregisterSchema.parse(await request.json());

  await prisma.deviceToken.deleteMany({ where: { token, userId } });

  return NextResponse.json({ ok: true });
});
