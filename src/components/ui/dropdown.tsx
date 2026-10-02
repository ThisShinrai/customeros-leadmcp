'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

const MENU_W = 196;

/**
 * Action menu. The menu is portalled to <body> and positioned with fixed
 * coordinates from the trigger's rect, so it never gets clipped by an ancestor's
 * `overflow:hidden` (e.g. the card a row lives in) and never spills off-screen —
 * it flips above the trigger when there's no room below and clamps horizontally.
 */
export function DropdownMenu({
  trigger, items, align = 'right',
}: { trigger: React.ReactNode; items: DropdownItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = Math.max(MENU_W, menuRef.current?.offsetWidth ?? MENU_W);
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const gap = 6;

    // Vertical: below the trigger; flip up if it would run off the bottom.
    let top = r.bottom + gap;
    if (menuH && top + menuH > vh - 8) {
      const up = r.top - gap - menuH;
      top = up >= 8 ? up : Math.max(8, vh - menuH - 8);
    }
    // Horizontal: align to the requested edge, then clamp into the viewport.
    let left = align === 'right' ? r.right - menuW : r.left;
    left = Math.min(left, vw - menuW - 8);
    left = Math.max(8, left);

    setCoords({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Re-place once the menu has measured (for the flip + width).
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <span ref={triggerRef} style={{ display: 'inline-flex' }}>
      <span onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{trigger}</span>
      {mounted && open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: coords.top, left: coords.left, minWidth: MENU_W,
            background: '#fff', borderRadius: 13, border: '1px solid var(--line)',
            boxShadow: '0 16px 44px rgba(0,0,0,.16), 0 2px 6px rgba(0,0,0,.06)',
            padding: 6, zIndex: 2000,
            animation: 'dropdownIn .16s var(--ease)',
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '9px 11px', borderRadius: 9, fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                border: 'none', background: 'transparent',
                color: item.danger ? '#DC2626' : 'var(--ink)', transition: 'background .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? '#FEF2F2' : 'var(--wash)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {item.icon && <span style={{ display: 'flex', flexShrink: 0, opacity: 0.8 }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </span>
  );
}
