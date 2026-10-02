'use client';

import React from 'react';

/* ─────────────────────────── Button ─────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, disabled, style, ...rest }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 100, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', whiteSpace: 'nowrap',
    transition: 'transform .14s var(--ease), opacity .14s, background .14s, color .14s',
    fontSize: size === 'sm' ? 13 : 14,
    padding: size === 'sm' ? '8px 14px' : '11px 20px',
    opacity: disabled || loading ? 0.55 : 1,
    pointerEvents: disabled || loading ? 'none' : 'auto',
  };
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff' },
    secondary: { background: '#fff', color: 'var(--black)', border: '1.5px solid var(--line)' },
    ghost: { background: 'transparent', color: 'var(--mid)' },
    danger: { background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' },
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => { if (!disabled && !loading) e.currentTarget.style.transform = 'translateY(-1px)'; rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; rest.onMouseLeave?.(e); }}
    >
      {loading ? <Spinner size={14} color={variant === 'primary' ? '#fff' : 'var(--mid)'} /> : icon}
      {children}
    </button>
  );
}

/* ─────────────────────────── IconButton ─────────────────────────── */

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}
export function IconButton({ children, label, style, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      style={{
        width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--line)',
        background: '#fff', color: 'var(--mid)', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'background .14s, color .14s, transform .14s var(--ease)', ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--black)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'scale(1.06)'; rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--mid)'; e.currentTarget.style.transform = 'scale(1)'; rest.onMouseLeave?.(e); }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── Field + Input ─────────────────────────── */

export function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: 6, ...style }}>
      {children}
    </label>
  );
}

interface FieldProps {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}
export function Field({ label, hint, children, style }: FieldProps) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={`cos-input ${className || ''}`} {...rest} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, style, ...rest }, ref) {
    return <textarea ref={ref} className={`cos-input ${className || ''}`} style={{ resize: 'vertical', minHeight: 90, ...style }} {...rest} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return <select ref={ref} className={`cos-input ${className || ''}`} style={{ cursor: 'pointer', appearance: 'none' }} {...rest}>{children}</select>;
  },
);

/* ─────────────────────────── Chip ─────────────────────────── */

type ChipVariant = 'filled' | 'outline' | 'gray' | 'accent' | 'green' | 'amber' | 'red';
export function Chip({ children, variant = 'gray', style }: { children: React.ReactNode; variant?: ChipVariant; style?: React.CSSProperties }) {
  const variants: Record<ChipVariant, React.CSSProperties> = {
    filled: { background: 'var(--black)', color: '#fff' },
    outline: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)' },
    gray: { background: 'var(--wash)', color: 'var(--mid)' },
    accent: { background: 'rgba(var(--accent-rgb), .1)', color: 'var(--accent)' },
    green: { background: '#F0FDF4', color: '#16A34A' },
    amber: { background: '#FFFBEB', color: '#D97706' },
    red: { background: '#FEF2F2', color: '#DC2626' },
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, lineHeight: 1.4, ...variants[variant], ...style }}>
      {children}
    </span>
  );
}

/* ─────────────────────────── Spinner ─────────────────────────── */

export function Spinner({ size = 18, color = 'var(--mid)' }: { size?: number; color?: string }) {
  return (
    <span style={{ display: 'inline-block', width: size, height: size, border: `2px solid rgba(0,0,0,.12)`, borderTopColor: color, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
  );
}

/* ─────────────────────────── EmptyState ─────────────────────────── */

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 24px' }}>
      {icon && (
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--wash)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', marginBottom: 18 }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13.5, color: 'var(--faint)', maxWidth: 340, lineHeight: 1.5, marginBottom: action ? 20 : 0 }}>{description}</div>}
      {action}
    </div>
  );
}
