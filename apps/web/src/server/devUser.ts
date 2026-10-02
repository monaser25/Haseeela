import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from './auth';
import { prisma } from './prisma';
import { HttpError } from './errors';


const makeEmail = (userId: string) => {
  const safeId = userId.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return `${safeId}@flowledger.local`;
};

export const ensureUser = async (user: AuthenticatedUser) => {
  const userId = user.id;

  // Fail closed if this user is marked for deletion in any state
  const userDeletion = await prisma.accountDeletion.findUnique({
    where: { userId },
  });
  if (userDeletion) {
    throw new HttpError(403, 'Account is pending deletion or deleted');
  }

  const email = user.email || makeEmail(userId);
  const name = user.name?.trim() || email.split('@')[0] || 'Haseeela User';
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) {
    const data: { email?: string; name?: string } = {};
    if (existing.email !== email) data.email = email;
    if (user.name?.trim() && existing.name !== user.name.trim()) data.name = user.name.trim();
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }
    return;
  }

  // No workspace row exists for this auth id yet. If the email is already taken
  // by a DIFFERENT (stale) row — e.g. the Supabase account was deleted and then
  // re-created with the same email, giving it a brand-new auth id — adopt that
  // existing workspace by re-pointing it to the current id, UNLESS the previous
  // owner was marked for deletion.
  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail && existingByEmail.id !== userId) {
    const emailOwnerDeletion = await prisma.accountDeletion.findUnique({
      where: { userId: existingByEmail.id },
    });
    if (emailOwnerDeletion) {
      // Never delete another user's financial workspace from ensureUser.
      // Fail closed with a conflict error until background maintenance cleans up.
      throw new HttpError(409, 'Previous workspace for this email is pending cleanup. Please retry shortly.');
    }
    await prisma.user.update({ where: { email }, data: { id: userId } });
    return;
  }

  try {
    await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        password: 'supabase-auth',
      },
    });
  } catch (err) {
    // Lost a race to a concurrent create for the same id/email — the row exists
    // now, so treat it as success.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
    throw err;
  }
};

