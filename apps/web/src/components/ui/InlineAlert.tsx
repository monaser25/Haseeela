import React from 'react';
import { Icon } from './Icon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InlineAlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: string | React.ReactNode;
  body?: string | React.ReactNode;
  tone?: 'positive' | 'negative' | 'warning' | 'info';
  icon?: string;
}

export function InlineAlert({ className, title, body, tone = 'info', icon, children, ...props }: InlineAlertProps) {
  const tones = {
    positive: { bg: "bg-positive-tint", border: "border-positive-border", icon: "checkCircle", iconColor: "text-positive-text" },
    negative: { bg: "bg-negative-tint", border: "border-negative-border", icon: "alertCircle", iconColor: "text-negative-text" },
    warning: { bg: "bg-warning-tint", border: "border-warning-border", icon: "alertTriangle", iconColor: "text-warning-text" },
    info: { bg: "bg-info-tint", border: "border-info-border", icon: "info", iconColor: "text-info" },
  };

  const t = tones[tone];
  const iconName = icon || t.icon;

  return (
    <div 
      className={cn(
        "flex gap-3 p-4 rounded-md border",
        t.bg,
        t.border,
        className
      )} 
      role={tone === 'negative' ? 'alert' : 'status'}
      {...props}
    >
      <div className={cn("mt-0.5 shrink-0", t.iconColor)}>
        <Icon name={iconName} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        {title && <div className={cn("t-body-m font-semibold mb-1", t.iconColor)}>{title}</div>}
        {body && <div className="t-body text-text-secondary">{body}</div>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}
