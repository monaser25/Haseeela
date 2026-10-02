import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { env } from '../config/env';
import { getSupabaseClient } from './supabase';
import { clearQueryAndPersistedCache } from '../query/queryClient';
import {
  getSessionEpoch,
  getCurrentAuthUserId,
  setAuthScope,
  resetAuthScope,
  bumpSessionEpoch,
  enqueueAuthOp,
} from './authScope';
import { beginPushUnregister } from '../services/push/unregisterPush';

export {
  getSessionEpoch,
  getCurrentAuthUserId,
  setAuthScope,
  resetAuthScope,
  bumpSessionEpoch,
} from './authScope';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const currentUserIdRef = useRef<string | undefined>(undefined);
  const authEventSeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const initiationSeqRef = useRef<number>(0);
  const activeInitiationRef = useRef<{
    id: number;
    type: 'signIn' | 'signUp' | 'signOut';
    identifier?: string;
  } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    const client = getSupabaseClient();
    const bootstrapSeq = ++authEventSeqRef.current;

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMountedRef.current || authEventSeqRef.current !== bootstrapSeq || activeInitiationRef.current !== null) {
          return;
        }
        if (error || !data.session) {
          if (getCurrentAuthUserId() !== undefined) {
            bumpSessionEpoch();
          }
          setAuthScope(null);
          currentUserIdRef.current = undefined;
          setSession(null);
          setStatus('signedOut');
        } else {
          const userId = data.session.user.id;
          if (getCurrentAuthUserId() && getCurrentAuthUserId() !== userId) {
            bumpSessionEpoch();
          }
          setAuthScope(userId);
          currentUserIdRef.current = userId;
          setSession(data.session);
          setStatus('signedIn');
        }
      })
      .catch(() => {
        if (!isMountedRef.current || authEventSeqRef.current !== bootstrapSeq || activeInitiationRef.current !== null) {
          return;
        }
        if (getCurrentAuthUserId() !== undefined) {
          bumpSessionEpoch();
        }
        setAuthScope(null);
        currentUserIdRef.current = undefined;
        setSession(null);
        setStatus('signedOut');
      });

    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!isMountedRef.current) return;

      ++authEventSeqRef.current;
      const nextUserId = nextSession?.user?.id;
      const prevUserId = currentUserIdRef.current;

      // Distinguish signUp's own SIGNED_IN event from foreign account transitions
      const isOwnSignUpEvent =
        activeInitiationRef.current?.type === 'signUp' &&
        Boolean(nextSession?.user?.email) &&
        nextSession?.user?.email?.toLowerCase() === activeInitiationRef.current.identifier?.toLowerCase();

      if (!isOwnSignUpEvent && (prevUserId !== nextUserId || event === 'SIGNED_OUT' || event === 'SIGNED_IN')) {
        activeInitiationRef.current = null;
      }

      currentUserIdRef.current = nextUserId;
      setAuthScope(nextUserId ?? null);

      if (prevUserId && nextUserId && prevUserId !== nextUserId) {
        bumpSessionEpoch();
      } else if (event === 'SIGNED_OUT') {
        bumpSessionEpoch();
      }

      setSession(nextSession);
      setStatus(nextSession ? 'signedIn' : 'signedOut');

      if ((prevUserId && nextUserId && prevUserId !== nextUserId) || event === 'SIGNED_OUT') {
        clearQueryAndPersistedCache().catch(() => undefined);
      }
    });

    return () => {
      isMountedRef.current = false;
      resetAuthScope();
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const client = getSupabaseClient();

    // Per-method staleness at queue-execution time. Every initiation takes an increasing id
    // (initiationSeqRef); a queued op may sit behind slower auth work, so it re-checks before
    // touching the SDK:
    // - signIn / signUp: stale once any newer initiation (sign-out, another sign-in) exists or the
    //   provider unmounted. A queued sign-in must never resurrect a session the user just left.
    // - signOut (primary): never stale. It was queued while signed in and must still sign out;
    //   FIFO order guarantees any later sign-in runs after it.
    // - signOut fallback (scope: local): skipped when a newer initiation exists or a DIFFERENT owner
    //   than the one that initiated the sign-out is now signed in. The same owner re-published by an
    //   SDK event (e.g. TOKEN_REFRESHED) while the primary sign-out failed still gets the local
    //   sign-out, since that is exactly what the fallback is for. The post-signUp sign-out is skipped when a newer initiation exists. Neither
    //   can kill a newer session.
    const isSuperseded = (id: number) => !isMountedRef.current || initiationSeqRef.current !== id;
    // The post-signUp sign-out targets the session that signUp itself created, so the scope
    // legitimately holds that new user id; only a newer initiation makes it stale.
    const mayRunFollowUpSignOut = (id: number) =>
      !isSuperseded(id) && activeInitiationRef.current?.id === id;

    return {
      session,
      user: session?.user ?? null,
      status,

      signIn: async (email: string, password: string) => {
        const id = ++initiationSeqRef.current;
        activeInitiationRef.current = { id, type: 'signIn', identifier: email.trim() };
        ++authEventSeqRef.current;

        const result = await enqueueAuthOp(async () => {
          if (isSuperseded(id)) return null;
          return client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
        });
        // Superseded before it ran: the user's later action wins, nothing to report
        if (!result) return;
        if (result.error) throw result.error;
      },

      signUp: async (email: string, password: string, name?: string) => {
        const id = ++initiationSeqRef.current;
        activeInitiationRef.current = { id, type: 'signUp', identifier: email.trim() };
        const emailRedirectTo = `${env.apiUrl}/verify`;

        const signUpResult = await enqueueAuthOp(async () => {
          if (isSuperseded(id)) return null;
          return client.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo,
              data: name ? { name } : undefined,
            },
          });
        });
        // Never report a confirmation email for a sign-up that did not run
        if (!signUpResult) throw new Error('Sign-up was superseded by a newer auth action');
        const { data, error } = signUpResult;

        if (error) throw error;

        // If a session was immediately returned without email confirmation, sign out
        // to mirror web behaviour and require email confirmation
        if (data.session) {
          if (activeInitiationRef.current?.id === id && isMountedRef.current) {
            try {
              const signOutResult = await enqueueAuthOp(async () => {
                if (!mayRunFollowUpSignOut(id)) return null;
                return client.auth.signOut();
              });
              if (signOutResult?.error && activeInitiationRef.current?.id === id && isMountedRef.current) {
                await enqueueAuthOp(async () => {
                  if (!mayRunFollowUpSignOut(id)) return;
                  await client.auth.signOut({ scope: 'local' });
                });
              }
            } catch {
              if (activeInitiationRef.current?.id === id && isMountedRef.current) {
                await enqueueAuthOp(async () => {
                  if (!mayRunFollowUpSignOut(id)) return;
                  await client.auth.signOut({ scope: 'local' });
                }).catch(() => undefined);
              }
            }
            if (activeInitiationRef.current?.id === id && isMountedRef.current) {
              bumpSessionEpoch();
              setAuthScope(null);
              currentUserIdRef.current = undefined;
              setSession(null);
              setStatus('signedOut');
            }
          }
        }

        return { requiresEmailConfirmation: true };
      },

      resendConfirmation: async (email: string) => {
        const { error } = await client.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: {
            emailRedirectTo: `${env.apiUrl}/verify`,
          },
        });
        if (error) throw error;
      },

      resetPassword: async (email: string) => {
        const redirectTo = `${env.apiUrl}/reset-password`;
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });
        if (error) throw error;
      },

      signOut: async () => {
        const id = ++initiationSeqRef.current;
        const initiatingOwner = currentUserIdRef.current;
        // Best-effort device-token unregister for the outgoing owner. It must start here: the
        // lines below clear the owner and token. It is only awaited inside the queued SDK sign-out
        // (bounded by its own timeout, never rejects), so local sign-out is not blocked by the network.
        const pushUnregister = beginPushUnregister({
          ownerId: initiatingOwner,
          accessToken: session?.user?.id === initiatingOwner ? session?.access_token : undefined,
        });
        activeInitiationRef.current = { id, type: 'signOut', identifier: initiatingOwner };
        // Same owner or signed out: run. A different owner means a newer session we must not kill.
        const mayRunLocalFallback = () => {
          if (isSuperseded(id)) return false;
          const scope = getCurrentAuthUserId();
          return typeof scope !== 'string' || scope === initiatingOwner;
        };

        bumpSessionEpoch();
        setAuthScope(null);
        currentUserIdRef.current = undefined;
        setSession(null);
        setStatus('signedOut');

        try {
          const { error } = await enqueueAuthOp(() =>
            pushUnregister ? pushUnregister.then(() => client.auth.signOut()) : client.auth.signOut()
          );
          // An SDK event re-publishing the same user clears activeInitiationRef, so gate on
          // supersession (checked again inside the queued op) rather than on that ref.
          if (error && !isSuperseded(id)) {
            await enqueueAuthOp(async () => {
              if (!mayRunLocalFallback()) return;
              await client.auth.signOut({ scope: 'local' });
            });
          }
        } catch {
          if (!isSuperseded(id)) {
            await enqueueAuthOp(async () => {
              if (!mayRunLocalFallback()) return;
              await client.auth.signOut({ scope: 'local' });
            }).catch(() => undefined);
          }
        } finally {
          if (activeInitiationRef.current?.id === id && currentUserIdRef.current === undefined) {
            await clearQueryAndPersistedCache();
          }
        }
      },
    };
  }, [session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
