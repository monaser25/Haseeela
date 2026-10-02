import { prisma } from '@/server/prisma';
import { PUSH_ROUTE_ALLOWLIST, isAllowedPushRoute, type PushRoute } from '@haseela/shared/lib/pushRoutes';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 10_000;

export { PUSH_ROUTE_ALLOWLIST, isAllowedPushRoute };
export type { PushRoute };

export type PushKind = 'billing_due' | 'invoice_overdue' | 'reminders';

export type PushMessage = {
  kind: PushKind;
  route: PushRoute;
  /** Only valid (and required) for `/(app)/invoice/[id]`. */
  params?: { id: string };
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: {
    kind: PushKind;
    titleKey: string;
    bodyKey: string;
    route: PushRoute;
    params?: { id: string };
  };
};

type ExpoTicket = { status?: string; details?: { error?: string } };

export type PushDeps = { fetchImpl?: typeof fetch };

// Payloads intentionally carry no user data (no names, amounts, emails). The
// title/body are generic English fallbacks; the app localises from the keys.
const COPY: Record<PushKind, { titleKey: string; bodyKey: string; title: string; body: string }> = {
  billing_due: {
    titleKey: 'push.billingDue.title',
    bodyKey: 'push.billingDue.body',
    title: 'Haseela',
    body: 'A payment is coming up.',
  },
  invoice_overdue: {
    titleKey: 'push.invoiceOverdue.title',
    bodyKey: 'push.invoiceOverdue.body',
    title: 'Haseela',
    body: 'An invoice is overdue.',
  },
  reminders: {
    titleKey: 'push.reminders.title',
    bodyKey: 'push.reminders.body',
    title: 'Haseela',
    body: 'You have new reminders.',
  },
};

export const buildPushPayload = (token: string, message: PushMessage): ExpoPushMessage => {
  if (!isAllowedPushRoute(message.route, message.params)) {
    throw new Error('Push route is not allowlisted');
  }
  const copy = COPY[message.kind];
  return {
    to: token,
    title: copy.title,
    body: copy.body,
    sound: 'default',
    data: {
      kind: message.kind,
      titleKey: copy.titleKey,
      bodyKey: copy.bodyKey,
      route: message.route,
      ...(message.params ? { params: { id: message.params.id } } : {}),
    },
  };
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Send one message to every device of a user. Best-effort: never throws, never
 * logs tokens or message content. Tokens Expo reports as DeviceNotRegistered
 * are deleted. Returns counts for observability/tests.
 */
export const sendPushToUser = async (
  userId: string,
  message: PushMessage,
  deps: PushDeps = {},
): Promise<{ sent: number; removed: number }> => {
  try {
    if (!isAllowedPushRoute(message.route, message.params)) {
      console.warn('Push skipped: route not allowlisted');
      return { sent: 0, removed: 0 };
    }

    const devices = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
    const tokens = devices.map((d) => d.token);
    if (tokens.length === 0) return { sent: 0, removed: 0 };

    const doFetch = deps.fetchImpl ?? fetch;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let sent = 0;
    const dead: string[] = [];

    for (const batch of chunk(tokens, EXPO_PUSH_BATCH_SIZE)) {
      try {
        const response = await doFetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch.map((token) => buildPushPayload(token, message))),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          console.error(`Expo push request failed with status ${response.status}`);
          continue;
        }
        const json = (await response.json()) as { data?: ExpoTicket[] };
        const tickets = Array.isArray(json?.data) ? json.data : [];
        tickets.forEach((ticket, index) => {
          if (ticket?.status === 'ok') {
            sent += 1;
          } else if (ticket?.details?.error === 'DeviceNotRegistered' && batch[index]) {
            dead.push(batch[index]);
          }
        });
      } catch {
        console.error('Expo push batch failed');
      }
    }

    if (dead.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { userId, token: { in: dead } } });
    }
    return { sent, removed: dead.length };
  } catch {
    console.error('Push delivery failed');
    return { sent: 0, removed: 0 };
  }
};
