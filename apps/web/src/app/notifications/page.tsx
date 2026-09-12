'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore, type AppNotification } from '@/store/notificationStore';
import { formatDate } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/locales';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';

const typeConfig: Record<string, { icon: string; cls: string }> = {
  BILLING_DUE: { icon: 'clock', cls: 'bg-warning-tint text-warning-text' },
  INVOICE_OVERDUE: { icon: 'alertTriangle', cls: 'bg-negative-tint text-negative-text' },
  PAYMENT_RECORDED: { icon: 'checkCircle', cls: 'bg-positive-tint text-positive-text' },
  WEEKLY_SUMMARY: { icon: 'barChart3', cls: 'bg-info-tint text-info' },
  INFO: { icon: 'info', cls: 'bg-accent-tint text-accent' },
};

const relTime = (iso: string, locale: Locale, t: any) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.time.justNow');
  if (mins < 60) return t('notifications.time.minsAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notifications.time.hrsAgo', { hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('notifications.time.daysAgo', { days });
  return formatDate(iso, locale, { month: 'short', day: 'numeric' });
};

export default function NotificationsPage() {
  const router = useRouter();
  const { t, locale, dir } = useLocale();
  const { notifications, unread, isLoaded, load, markRead, markAllRead } = useNotificationStore();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const onRow = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="t-h1">{t('notifications.title')}</h1>
          <p className="t-body text-text-muted mt-1">{t('notifications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as 'all' | 'unread')}
            options={[{ value: 'all', label: t('notifications.tabs.all') }, { value: 'unread', label: unread ? t('notifications.tabs.unreadCount', { count: unread }) : t('notifications.tabs.unread') }]}
          />
          <Button variant="secondary" size="sm" disabled={unread === 0} onClick={markAllRead}>{t('notifications.actions.markAllRead')}</Button>
        </div>
      </div>

      <Card pad={0}>
        {!isLoaded ? (
          <div className="py-12 text-center text-text-muted text-[13px]">{t('notifications.empty.loading')}</div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="bell"
            title={tab === 'unread' ? t('notifications.empty.noUnread') : t('notifications.empty.caughtUp')}
            body={t('notifications.empty.body')}
          />
        ) : (
          <div className="divide-y divide-border">
            {list.map((n) => {
              const cfg = typeConfig[n.type] || typeConfig.INFO;
              return (
                <button
                  key={n.id}
                  onClick={() => onRow(n)}
                  className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-surface-hover transition-colors focus-ring"
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.cls}`}>
                    <Icon name={cfg.icon} size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`t-body-m ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                    </div>
                    {n.body && <div className="t-small text-text-secondary mt-0.5">{n.body}</div>}
                    <div className="t-micro text-text-muted mt-1" dir={dir}>{relTime(n.createdAt, locale, t)}</div>
                  </div>
                  {n.link && <Icon name={dir === 'rtl' ? 'chevronLeft' : 'chevronRight'} size={16} className="text-text-muted shrink-0 mt-2" />}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
