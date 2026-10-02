/**
 * Push-notification deep-link allowlist, shared by the sender (apps/web) and the
 * receiver (apps/mobile) so both sides validate against one source of truth.
 * A push may only navigate to one of these routes; anything else is ignored.
 */

/** Navigation targets a push may deep-link to. Must match routes in apps/mobile/src/app. */
export const PUSH_ROUTE_ALLOWLIST = [
  '/(app)/invoice/[id]',
  '/(app)/subscriptions',
  '/(app)/notifications',
] as const;
export type PushRoute = (typeof PUSH_ROUTE_ALLOWLIST)[number];

export type PushRouteParams = { id: string };

export const PUSH_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Returns true only for allowlisted routes with correctly-shaped params. */
export const isAllowedPushRoute = (route: unknown, params?: { id?: unknown }): boolean => {
  if (typeof route !== 'string' || !(PUSH_ROUTE_ALLOWLIST as readonly string[]).includes(route)) return false;
  if (route === '/(app)/invoice/[id]') {
    return typeof params?.id === 'string' && PUSH_ID_PATTERN.test(params.id);
  }
  return params === undefined;
};

/**
 * Extracts a validated navigation target from an untrusted push `data` payload.
 * Returns null when the payload is not an object or the route/params are not allowed.
 */
export const parsePushNavigation = (
  data: unknown,
): { route: PushRoute; params?: PushRouteParams } | null => {
  if (typeof data !== 'object' || data === null) return null;
  const { route, params } = data as { route?: unknown; params?: { id?: unknown } };
  if (!isAllowedPushRoute(route, params)) return null;
  if (route === '/(app)/invoice/[id]') {
    return { route: route as PushRoute, params: { id: (params as PushRouteParams).id } };
  }
  return { route: route as PushRoute };
};
