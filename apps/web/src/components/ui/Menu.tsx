'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface MenuItem {
  icon?: string;
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  width?: number;
  /** Where the panel opens relative to the trigger. */
  side?: 'bottom' | 'top';
  /** Extra classes for the wrapper (e.g. `w-full` so the trigger can fill its container). */
  className?: string;
}

export function Menu({ trigger, items, align = 'right', width = 200, side = 'bottom', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      <span onClick={() => setOpen((o) => !o)} className="contents">
        {trigger}
      </span>
      {open && (
        <div
        role="menu"
        style={{ width, [align === 'right' ? 'insetInlineEnd' : 'insetInlineStart']: 0, [side === 'bottom' ? 'top' : 'bottom']: 'calc(100% + 6px)' }}
        className="absolute z-[120] p-1.5 rounded-md border border-border bg-surface-elevated shadow-lg anim-scale origin-top"
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={`d-${i}`} className="h-px bg-border my-1.5 -mx-0.5" />
            ) : (
              <button
                key={item.label || i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2.5 h-9 rounded-sm text-start text-sm transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed',
                  item.danger
                    ? 'text-negative-text hover:bg-negative-tint'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                )}
              >
                {item.icon && <Icon name={item.icon} size={16} />}
                <span className="flex-1">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
