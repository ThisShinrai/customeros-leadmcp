'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Bell, FolderKanban, CheckSquare, FileUp, ReceiptText, MessageSquare,
} from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import {
  getNotifications, markNotificationsSeen, type NotificationItem, type NotificationKind,
} from './notifications-actions';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const POLL_MS = 30_000;
const PANEL_WIDTH = 360;

const ICONS: Record<NotificationKind, React.ReactNode> = {
  project: <FolderKanban size={15} />,
  task: <CheckSquare size={15} />,
  file: <FileUp size={15} />,
  invoice: <ReceiptText size={15} />,
  message: <MessageSquare size={15} />,
};

interface NotificationsBellProps {
  initialUnread?: number;
}

export function NotificationsBell({ initialUnread = 0 }: NotificationsBellProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Position the portal panel under the bell, right-aligned to it — but never
  // let it spill off the left edge (on mobile the bell isn't at the screen edge
  // because the avatar sits to its right, so a naive right-align overflows left).
  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(PANEL_WIDTH, vw - 24);
    const rightAligned = vw - r.right;
    const maxRight = vw - width - 12; // keeps the panel's left edge ≥ 12px
    const right = Math.max(12, Math.min(rightAligned, maxRight));
    setCoords({ top: r.bottom + 8, right });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const refresh = useCallback(async (): Promise<number> => {
    try {
      const res = await getNotifications();
      setItems(res.items);
      setUnread(res.unread);
      return res.unread;
    } catch {
      return 0;
    }
  }, []);

  // Open: load fresh list, then mark seen and clear the badge.
  const handleOpen = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    await refresh();
    setLoading(false);
    try {
      await markNotificationsSeen();
    } catch {
      /* non-fatal — badge still clears for this session */
    }
    setUnread(0);
    // Re-render items as read (the panel is already open).
    setItems((prev) => prev.map((i) => (i.unread ? { ...i, unread: false } : i)));
  }, [refresh]);

  const toggle = useCallback(() => {
    if (open) setOpen(false);
    else void handleOpen();
  }, [open, handleOpen]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Light background poll for the badge while mounted (skip while open — open
  // already refreshes and would otherwise re-light a badge the user just saw).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || open) return;
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Benachrichtigungen"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
        style={{
          width: 32, height: 32, borderRadius: 9,
          border: '1px solid var(--line)',
          background: open ? 'var(--black)' : 'transparent',
          color: open ? '#fff' : '#505050',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
          transition: `background .24s ${EASE}, color .24s ${EASE}, transform .24s ${EASE}`,
        }}
        onMouseEnter={(e) => {
          if (open) return;
          const el = e.currentTarget;
          el.style.background = 'var(--black)';
          el.style.color = '#fff';
          el.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.background = open ? 'var(--black)' : 'transparent';
          el.style.color = open ? '#fff' : '#505050';
          el.style.transform = 'scale(1)';
        }}
      >
        <Bell size={15} />
      </button>

      {unread > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 17, height: 17, padding: '0 4px',
            borderRadius: 999,
            background: 'var(--accent)', color: '#fff',
            fontSize: 10, fontWeight: 800, lineHeight: '17px',
            textAlign: 'center',
            border: '2px solid #fff',
            boxShadow: '0 2px 6px rgba(var(--accent-rgb), .45)',
            pointerEvents: 'none',
          }}
        >
          {badge}
        </span>
      )}

      {mounted && open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label="Benachrichtigungen"
          style={{
            position: 'fixed', top: coords.top, right: coords.right,
            width: PANEL_WIDTH, maxWidth: 'calc(100vw - 24px)',
            background: '#fff', borderRadius: 16,
            border: '1px solid var(--line)',
            boxShadow: '0 20px 56px rgba(0,0,0,.18)',
            zIndex: 2000, overflow: 'hidden',
            animation: `dropdownIn .18s ${EASE}`,
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', borderBottom: '1px solid var(--line)',
          }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--black)', letterSpacing: '-0.2px' }}>
              Benachrichtigungen
            </span>
            {items.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--faint)' }}>
                {items.length}
              </span>
            )}
          </div>

          {/* Body */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>
                Lädt …
              </div>
            ) : items.length === 0 ? (
              <EmptyState />
            ) : (
              items.map((it) => (
                <NotificationRow key={it.id} item={it} onClick={() => go(it.href)} />
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function NotificationRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
        padding: '11px 16px', background: 'transparent',
        borderBottom: '1px solid var(--wash)',
        transition: `background .14s ${EASE}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--wash)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: item.unread ? 'rgba(var(--accent-rgb), .12)' : 'var(--wash)',
        color: item.unread ? 'var(--accent)' : 'var(--mid)',
      }}>
        {ICONS[item.kind]}
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--black)', letterSpacing: '-0.1px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.title}
          </span>
          {item.unread && (
            <span aria-hidden style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
            }} />
          )}
        </span>
        <span style={{
          fontSize: 12, color: 'var(--mid)', lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.subtitle}
        </span>
        <span suppressHydrationWarning style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>
          {relativeTime(item.time)}
        </span>
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '34px 20px', textAlign: 'center',
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, borderRadius: 13, background: 'var(--wash)', color: 'var(--pale)',
      }}>
        <Bell size={20} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
        Keine neuen Benachrichtigungen
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--faint)', maxWidth: 220, lineHeight: 1.45 }}>
        Neue Projekte, Aufgaben, Dateien und Nachrichten erscheinen hier.
      </span>
    </div>
  );
}
