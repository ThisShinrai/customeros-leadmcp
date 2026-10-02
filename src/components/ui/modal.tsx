'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './primitives';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 480 }: ModalProps) {
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

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(10,10,10,.42)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        animation: 'overlayIn .2s var(--ease)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff', borderRadius: 22, width: '100%', maxWidth: width,
          maxHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,.32)', animation: 'modalIn .28s var(--ease)', overflow: 'hidden',
        }}
      >
        {(title || subtitle) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '24px 26px 0' }}>
            <div>
              {title && <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--black)', letterSpacing: '-0.5px', margin: 0 }}>{title}</h2>}
              {subtitle && <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: '5px 0 0' }}>{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Schließen" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--wash)', color: 'var(--mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .14s, color .14s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--black)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--wash)'; e.currentTarget.style.color = 'var(--mid)'; }}>
              <X size={16} />
            </button>
          </div>
        )}
        <div style={{ padding: '20px 26px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 26px', borderTop: '1px solid var(--line)' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Bestätigen', danger, loading }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={() => onConfirm()}>{confirmLabel}</Button>
        </>
      }
    >
      <p style={{ fontSize: 14.5, color: 'var(--mid)', lineHeight: 1.55, margin: 0 }}>{message}</p>
    </Modal>
  );
}
