import React from 'react';
import { Icon } from './Icon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// status -> tone mapping for clients & transactions
export const STATUS_TONE: Record<string, BadgeProps['tone']> = { 
  Active: "positive", 
  Prospect: "info", 
  Completed: "accent", 
  Inactive: "neutral",
  Paid: "positive", 
  Sent: "info", 
  Draft: "neutral", 
  Overdue: "negative", 
  Outstanding: "warning" 
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info';
  icon?: string;
}

export function Badge({ className, tone = 'neutral', icon, children, ...props }: BadgeProps) {
  const tones = {
    neutral:  "bg-surface-hover text-text-secondary",
    accent:   "bg-accent-tint text-accent",
    positive: "bg-positive-tint text-positive-text",
    negative: "bg-negative-tint text-negative-text",
    warning:  "bg-warning-tint text-warning-text",
    info:     "bg-info-tint text-info",
  };

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-sm text-xs font-medium whitespace-nowrap",
        tones[tone],
        className
      )} 
      {...props}
    >
      {icon && <Icon name={icon} size={12} strokeWidth={2} />}
      {children}
    </span>
  );
}

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
}

export function FilterChip({ className, active, onClick, children, count, ...props }: FilterChipProps) {
  return (
    <button 
      onClick={onClick} 
      className={cn(
        "focus-ring h-8 px-3 rounded-full text-[13px] font-medium cursor-pointer inline-flex items-center gap-1.5 border transition-all duration-fast",
        active 
          ? "border-transparent bg-accent text-accent-fg" 
          : "border-border bg-surface hover:bg-surface-hover text-text-secondary",
        className
      )}
      {...props}
    >
      {children}
      {count != null && <span className="text-[11px] opacity-70 tnum">{count}</span>}
    </button>
  );
}

export interface DeltaChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  inverse?: boolean;
}

export function DeltaChip({ value, inverse = false, className, ...props }: DeltaChipProps) {
  const isUp = value >= 0;
  const isGood = inverse ? value <= 0 : value >= 0;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold tnum",
        isGood ? "text-positive-text" : "text-negative-text",
        className
      )}
      {...props}
    >
      <Icon name={isUp ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.5} />
      {Math.abs(value)}%
    </span>
  );
}
