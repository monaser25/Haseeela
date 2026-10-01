import { NextResponse } from 'next/server';
import { authenticateRequest, getUserId } from '@/server/auth';
import { ensureUser } from '@/server/devUser';
import { prisma } from '@/server/prisma';
import { withApiError } from '@/server/errors';
import { deviceRegisterSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Upsert by token. If the token belonged to another user (device changed hands)
// it is reassigned to the caller, so the previous owner stops receiving pushes.
export const POST = async (request: Request) => withApiError(request, async () => {
  const user = await authenticateRequest(request);
  const userId = getUserId(user);
  await ensureUser(user);
  const { token, platform } = deviceRegisterSchema.parse(await request.json());

  const now = new Date();
  await prisma.deviceToken.upsert({
    where: { token },
    create: { token, platform, userId, lastSeenAt: now },
    update: { userId, platform, lastSeenAt: now },
  });

  return NextResponse.json({ ok: true });
});
