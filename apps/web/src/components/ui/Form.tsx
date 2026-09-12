import React, { useState } from 'react';
import { Icon } from './Icon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface FieldProps extends React.HTMLAttributes<HTMLLabelElement> {
  label?: string | React.ReactNode;
  hint?: string | React.ReactNode;
  error?: string | React.ReactNode;
  htmlFor?: string;
}

export const Field = React.forwardRef<HTMLLabelElement, FieldProps>(
  ({ className, label, hint, error, children, htmlFor, ...props }, ref) => {
    return (
      <label ref={ref} htmlFor={htmlFor} className={cn("flex flex-col gap-1.5", className)} {...props}>
        {label && <span className="t-body-m text-text-secondary">{label}</span>}
        {children}
        {error ? (
          <span className="t-small text-negative-text">{error}</span>
        ) : hint ? (
          <span className="t-small text-text-muted">{hint}</span>
        ) : null}
      </label>
    );
  }
);
Field.displayName = 'Field';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  error?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, prefix, suffix, type = "text", ...props }, ref) => {
    const [focus, setFocus] = useState(false);
    
    const baseClass = "h-[38px] w-full rounded-sm text-sm text-start outline-none bg-surface text-text transition-all duration-fast placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed";
    
    const borderClass = error 
      ? "border border-negative" 
      : focus 
        ? "border border-border-strong shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]" 
        : "border border-border";

    if (prefix || suffix) {
      return (
        <div className={cn("flex items-center overflow-hidden", baseClass, borderClass, className)}>
          {prefix && <span className="t-body ps-3 text-text-muted whitespace-nowrap">{prefix}</span>}
          <input
            ref={ref}
            type={type}
            onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
            className="flex-1 min-w-0 border-none outline-none bg-transparent text-text h-full px-3 text-sm text-start placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed focus:shadow-none focus-visible:shadow-none"
            {...props}
          />
          {suffix && <span className="t-body pe-3 text-text-muted whitespace-nowrap">{suffix}</span>}
        </div>
      );
    }
    
    return (
      <input
        ref={ref}
        type={type}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        className={cn(baseClass, borderClass, "px-3", className)}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    const [focus, setFocus] = useState(false);
    
    const baseClass = "h-[38px] w-full rounded-sm text-sm outline-none bg-surface text-text transition-all duration-fast appearance-none cursor-pointer pe-9 ps-3 disabled:opacity-50 disabled:cursor-not-allowed";
    
    const borderClass = error 
      ? "border border-negative" 
      : focus 
        ? "border border-border-strong shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]" 
        : "border border-border";

    return (
      <div className="relative">
        <select
          ref={ref}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          className={cn(baseClass, borderClass, className)}
          {...props}
        >
          {children}
        </select>
        <Icon 
          name="chevronDown" 
          size={16} 
          className="absolute end-3 top-[11px] text-text-muted pointer-events-none" 
        />
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    const [focus, setFocus] = useState(false);
    
    const baseClass = "w-full rounded-sm text-sm outline-none bg-surface text-text transition-all duration-fast placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[80px] p-[10px_12px] leading-[20px] resize-y";
    
    const borderClass = error 
      ? "border border-negative" 
      : focus 
        ? "border border-border-strong shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]" 
        : "border border-border";

    return (
      <textarea
        ref={ref}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        className={cn(baseClass, borderClass, className)}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          "focus-ring shrink-0 w-[38px] h-[22px] rounded-full border-none p-0.5 transition-colors duration-base",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          checked ? "bg-accent" : "bg-border-strong",
          className
        )}
        {...props}
      >
        <span 
          className={cn(
            "block w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform duration-base ease-out",
            checked ? "ltr:translate-x-4 rtl:-translate-x-4" : "translate-x-0"
          )} 
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';

export interface SegmentedOption {
  label: string | React.ReactNode;
  value: string;
}

export interface SegmentedProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: (SegmentedOption | string)[];
  value?: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
}

export function Segmented({ className, options, value, onChange, size = 'md', ...props }: SegmentedProps) {
  const hClass = size === 'sm' ? "min-h-[32px] h-[32px]" : "min-h-[36px] h-[36px]";
  const optionValues = options.map((o) => (typeof o === "string" ? o : o.value));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % optionValues.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + optionValues.length) % optionValues.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = optionValues.length - 1;
    }
    if (nextIndex !== -1) {
      onChange(optionValues[nextIndex]);
    }
  };

  return (
    <div 
      role="tablist"
      className={cn("inline-flex p-[3px] gap-0.5 bg-surface-hover rounded-md border border-border items-center", className)} 
      {...props}
    >
      {options.map((o, idx) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        const active = val === value;
        return (
          <button 
            key={val} 
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(val)} 
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "focus-ring px-3.5 rounded-[calc(var(--r-md)-3px)] border-none cursor-pointer text-[13px] font-medium transition-all duration-fast inline-flex items-center justify-center",
              hClass,
              active 
                ? "bg-accent text-accent-fg shadow-sm"
                : "bg-transparent text-text-secondary hover:text-text"
            )}
          >
            {lab}
          </button>
        );
      })}
    </div>
  );
}

// Password Strength Utility
export function strength(pw: string): number {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0..4
}

export interface StrengthMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function StrengthMeter({ className, value, ...props }: StrengthMeterProps) {
  const s = strength(value);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = [
    "bg-negative", // 0
    "bg-negative", // 1
    "bg-warning",  // 2
    "bg-info",     // 3
    "bg-positive"  // 4
  ];
  
  const textColors = [
    "text-negative-text", 
    "text-negative-text", 
    "text-warning-text",  
    "text-info",     
    "text-positive-text"  
  ];

  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i} 
            className={cn(
              "flex-1 h-1 rounded-full transition-colors duration-base",
              i < s ? colors[s] : "bg-border"
            )} 
          />
        ))}
      </div>
      {value && <span className={cn("t-small", textColors[s])}>{labels[s]}</span>}
    </div>
  );
}
