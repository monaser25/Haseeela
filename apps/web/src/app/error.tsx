'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-6">
      <div className="w-16 h-16 rounded-full bg-negative-tint text-negative-text flex items-center justify-center">
        <Icon name="alertTriangle" size={28} />
      </div>
      <div className="space-y-1.5">
        <h1 className="t-h2">Something went wrong</h1>
        <p className="max-w-md t-body text-text-secondary">
          An unexpected error occurred. You can try again, or head back to your dashboard.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" icon="refreshCcw" onClick={() => reset()}>Try again</Button>
        <Button onClick={() => (window.location.href = '/')}>Back to dashboard</Button>
      </div>
    </div>
  );
}
