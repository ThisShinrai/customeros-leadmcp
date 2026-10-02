'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Side = 'right' | 'left' | 'bottom' | 'top';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: Side;
  width?: number;
}

const ANIM: Record<Side, string> = {
  right: 'drawerRight', left: 'drawerLeft', bottom: 'drawerBottom', top: 'drawerTop',
};

export function Drawer({ open, onClose, title, subtitle, children, footer, side = 'right', width = 520 }: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('cos-overlay-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; document.body.classList.remove('cos-overlay-open'); };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const horizontal = side === 'right' || side === 'left';
  // Explicit size — the overlay's backdrop-filter creates a containing block,
  // so top+bottom alone collapse to content height. Pin the size directly.
  const panel: React.CSSProperties = horizontal
    ? { top: 8, [side]: 8, height: 'calc(100dvh - 16px)', width: `min(${width}px, calc(100vw - 16px))` }
    : { left: 8, right: 8, [side]: 8, maxHeight: '88dvh', width: 'calc(100vw - 16px)' };

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(10,10,10,.40)', backdropFilter: 'blur(4px)',
        animation: 'overlayIn .2s var(--ease)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', ...panel,
          background: '#fff', borderRadius: 22,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,.34)',
          animation: `${ANIM[side]} .42s var(--ease)`,
          overflow: 'hidden',
        }}
      >
        {(title || subtitle) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '26px 28px 0', flexShrink: 0 }}>
            <div>
              {title && <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--black)', letterSpacing: '-0.6px', margin: 0 }}>{title}</h2>}
              {subtitle && <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: '6px 0 0', lineHeight: 1.5, maxWidth: 440 }}>{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Schließen" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--wash)', color: 'var(--mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .14s, color .14s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--black)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--wash)'; e.currentTarget.style.color = 'var(--mid)'; }}>
              <X size={17} />
            </button>
          </div>
        )}
        <div style={{ padding: '22px 28px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
