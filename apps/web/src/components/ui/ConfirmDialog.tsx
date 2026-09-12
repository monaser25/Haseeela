'use client';

import React from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | React.ReactNode;
  /** A highlighted impact line, e.g. "12 past transactions will be kept". */
  impact?: string | React.ReactNode;
  tone?: 'danger' | 'default';
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  /** Optional middle action (e.g. Archive instead of Delete permanently). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  impact,
  tone = 'default',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading,
  onConfirm,
  secondaryLabel,
  onSecondary,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth={460} dismissable={!loading}>
      <div className="flex flex-col items-center text-center gap-3 pt-1">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            tone === 'danger' ? 'bg-negative-tint text-negative-text' : 'bg-accent-tint text-accent'
          }`}
        >
          <Icon name={tone === 'danger' ? 'alertTriangle' : 'helpCircle'} size={24} />
        </div>
        <h2 className="t-h3">{title}</h2>
        {description && <p className="t-body text-text-secondary max-w-[360px]">{description}</p>}
        {impact && (
          <p className="t-small text-text-muted bg-surface-hover rounded-sm px-3 py-2 max-w-[380px]">{impact}</p>
        )}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-2 pt-5">
        <Button variant="secondary" disabled={loading} onClick={onClose}>
          {cancelLabel}
        </Button>
        {secondaryLabel && onSecondary && (
          <Button variant="secondary" disabled={loading} onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
        <Button variant={tone === 'danger' ? 'destructive' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
