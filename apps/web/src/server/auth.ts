import { User } from '@supabase/supabase-js';
import { HttpError } from './errors';
import { getSupabaseAuthClient } from './supabase';
import { prisma } from './prisma';

export type AuthenticatedUser = {
  id: string;
  email?: string;
  name?: string;
  isDev?: boolean;
};

export const extractBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) return null;

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  return token;
};

const DEV_TOKEN_PREFIX = 'flowledger-dev:';

const isDevAuthEnabled = () => (
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_AUTH === 'true'
);

const parseDevToken = (token: string): AuthenticatedUser | null => {
  if (!isDevAuthEnabled() || !token.startsWith(DEV_TOKEN_PREFIX)) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(token.slice(DEV_TOKEN_PREFIX.length))) as AuthenticatedUser;
    if (!parsed.id || typeof parsed.id !== 'string') return null;
    return {
      id: parsed.id,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      isDev: true,
    };
  } catch {
    return null;
  }
};

export const mapSupabaseUser = (user: User): AuthenticatedUser => ({
  id: user.id,
  ...(user.email ? { email: user.email } : {}),
  ...(user.user_metadata?.name ? { name: user.user_metadata.name as string } : {}),
});

export const authenticateRequest = async (
  request: Request,
  options?: { allowPendingDeletion?: boolean },
) => {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) throw new HttpError(401, 'Authentication required');

  let user = parseDevToken(token);
  if (!user) {
    const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');
    user = {
      ...mapSupabaseUser(data.user),
      isDev: false,
    };
  }

  // Fail closed if this user account is pending deletion or deleted
  const deletion = await prisma.accountDeletion.findUnique({
    where: { userId: user.id },
  });

  if (deletion) {
    if (deletion.status === 'COMPLETED') {
      if (options?.allowPendingDeletion) {
        return user;
      }
      throw new HttpError(401, 'Account has been deleted');
    }

    if (!options?.allowPendingDeletion) {
      throw new HttpError(403, 'Account is pending deletion');
    }
  }

  return user;
};

export const getUserId = (user: AuthenticatedUser) => {
  if (!user.id) throw new HttpError(401, 'Authentication required');
  return user.id;
};

