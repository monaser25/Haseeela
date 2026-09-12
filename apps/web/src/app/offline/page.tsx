'use client';

import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n';

export const dynamic = 'force-static';

export default function OfflinePage() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background text-text">
      <div className="w-16 h-16 rounded-full bg-warning-tint text-warning-text flex items-center justify-center">
        <Icon name="wifiOff" size={28} />
      </div>
      <div className="space-y-1.5">
        <h1 className="t-h2">{t('offline.title')}</h1>
        <p className="max-w-md t-body text-text-secondary">
          {t('offline.body')}
        </p>
      </div>
      <Button icon="refreshCcw" onClick={() => typeof window !== 'undefined' && window.location.reload()}>
        {t('offline.action.retry')}
      </Button>
    </div>
  );
}
