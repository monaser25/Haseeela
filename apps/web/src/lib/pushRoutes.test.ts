jest.mock('@/server/prisma', () => ({ prisma: {} }));

import {
  PUSH_ROUTE_ALLOWLIST,
  isAllowedPushRoute,
  parsePushNavigation,
} from '@haseela/shared/lib/pushRoutes';
import * as webPush from '@/server/push';

describe('isAllowedPushRoute', () => {
  it('accepts static routes without params', () => {
    expect(isAllowedPushRoute('/(app)/subscriptions')).toBe(true);
    expect(isAllowedPushRoute('/(app)/notifications')).toBe(true);
  });

  it('rejects params on static routes', () => {
    expect(isAllowedPushRoute('/(app)/subscriptions', { id: 'x' })).toBe(false);
  });

  it('requires a well-formed id for the invoice route', () => {
    expect(isAllowedPushRoute('/(app)/invoice/[id]', { id: 'inv_123-AB' })).toBe(true);
    expect(isAllowedPushRoute('/(app)/invoice/[id]')).toBe(false);
    expect(isAllowedPushRoute('/(app)/invoice/[id]', { id: '' })).toBe(false);
    expect(isAllowedPushRoute('/(app)/invoice/[id]', { id: '../settings' })).toBe(false);
    expect(isAllowedPushRoute('/(app)/invoice/[id]', { id: 'a'.repeat(65) })).toBe(false);
    expect(isAllowedPushRoute('/(app)/invoice/[id]', { id: 42 })).toBe(false);
  });

  it('rejects unknown and non-string routes', () => {
    expect(isAllowedPushRoute('/(app)/settings')).toBe(false);
    expect(isAllowedPushRoute('https://evil.example')).toBe(false);
    expect(isAllowedPushRoute(undefined)).toBe(false);
    expect(isAllowedPushRoute(['/(app)/notifications'])).toBe(false);
  });
});

describe('parsePushNavigation', () => {
  it('returns a validated target from push data', () => {
    expect(parsePushNavigation({ route: '/(app)/notifications' })).toEqual({ route: '/(app)/notifications' });
    expect(parsePushNavigation({ route: '/(app)/invoice/[id]', params: { id: 'abc' } })).toEqual({
      route: '/(app)/invoice/[id]',
      params: { id: 'abc' },
    });
  });

  it('returns null for malformed payloads', () => {
    expect(parsePushNavigation(null)).toBeNull();
    expect(parsePushNavigation('x')).toBeNull();
    expect(parsePushNavigation({})).toBeNull();
    expect(parsePushNavigation({ route: '/(app)/invoice/[id]', params: { id: 'a b' } })).toBeNull();
    expect(parsePushNavigation({ route: '/(app)/notifications', params: { id: 'a' } })).toBeNull();
  });
});

describe('web sender shares the same allowlist', () => {
  it('re-exports the shared source of truth', () => {
    expect(webPush.PUSH_ROUTE_ALLOWLIST).toBe(PUSH_ROUTE_ALLOWLIST);
    expect(webPush.isAllowedPushRoute).toBe(isAllowedPushRoute);
  });
});
