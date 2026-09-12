import React from 'react';
import { Icon } from './Icon';
import { DeltaChip } from './Badge';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pad?: number | string;
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, pad = 20, hover, onClick, style, children, ...props }, ref) => {
    
    // For custom pixel padding
    const paddingStyle = typeof pad === 'number' ? { padding: pad } : { padding: pad };
    
    return (
      <div 
        ref={ref}
        onClick={onClick}
        className={cn(
          "bg-surface border border-border rounded-lg",
          onClick ? "cursor-pointer focus-ring" : "",
          hover ? "transition-all duration-base ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong" : "",
          className
        )}
        style={{ ...paddingStyle, ...style }}
        // If onClick is present but no role/tabIndex is set, add them for basic accessibility
        role={onClick && !props.role ? "button" : props.role}
        tabIndex={onClick && props.tabIndex === undefined ? 0 : props.tabIndex}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.currentTarget.click();
          }
          props.onKeyDown?.(e);
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string | React.ReactNode;
  action?: React.ReactNode;
  sub?: string | React.ReactNode;
}

export function SectionHeader({ className, title, action, sub, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      <div>
        <div className="t-h3">{title}</div>
        {sub && <div className="t-small text-text-muted mt-0.5">{sub}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export interface StatCardProps extends Omit<CardProps, 'title'> {
  label: string;
  value: React.ReactNode;
  delta?: number;
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
  sub?: React.ReactNode;
  sparkline?: React.ReactNode;
  icon?: string;
}

export function StatCard({ 
  className, 
  label, 
  value, 
  delta, 
  tone = 'neutral', 
  sub, 
  sparkline, 
  onClick, 
  icon, 
  hover,
  ...props 
}: StatCardProps) {
  const valColor = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "warning" ? "text-warning" : "text-text";
  
  return (
    <Card 
      className={cn("flex flex-col gap-2.5 min-w-0", className)} 
      pad={20} 
      hover={hover ?? !!onClick} 
      onClick={onClick} 
      {...props}
    >
      <div className="flex items-center justify-between">
        <span className="t-caption text-text-muted">{label}</span>
        {icon && <span className="text-text-muted"><Icon name={icon} size={16} /></span>}
      </div>
      <div className={cn("t-display tnum", valColor)}>{value}</div>
      <div className="flex items-center gap-2 min-h-[18px]">
        {delta != null && <DeltaChip value={delta} />}
        {sub && <span className="t-small text-text-muted">{sub}</span>}
      </div>
      {sparkline && <div className="mt-1">{sparkline}</div>}
    </Card>
  );
}
