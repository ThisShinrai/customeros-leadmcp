'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

/**
 * Globaler Blur-Modus (Diskretion): über die Sidebar aktivierbar. Alles, was
 * mit Kunden zu tun hat (Angebote, Rechnungen, Kunden, Leads …), wird
 * geblurrt, unklickbar und nicht markierbar — z. B. wenn ein Kunde oder
 * Dritter auf den Bildschirm schaut. Zustand lebt in sessionStorage.
 */

interface PrivacyCtx {
  blurred: boolean;
  toggle: () => void;
  /** IDs (Kunde/Lead/…), die WÄHREND des Blur-Modus erstellt wurden — bleiben sichtbar. */
  allowed: ReadonlySet<string>;
  allow: (...ids: (string | null | undefined)[]) => void;
}

const Ctx = createContext<PrivacyCtx>({ blurred: false, toggle: () => {}, allowed: new Set(), allow: () => {} });
const STORAGE_KEY = 'cos-blur-mode';
const ALLOW_KEY = 'cos-blur-allowed';

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setBlurred(sessionStorage.getItem(STORAGE_KEY) === '1');
      const raw = sessionStorage.getItem(ALLOW_KEY);
      if (raw) setAllowed(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setBlurred((b) => {
      const next = !b;
      try {
        if (next) sessionStorage.setItem(STORAGE_KEY, '1');
        else { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(ALLOW_KEY); }
      } catch { /* ignore */ }
      // Blur beenden leert die Whitelist — nächste Session startet frisch.
      if (!next) setAllowed(new Set());
      return next;
    });
  }, []);

  const allow = useCallback((...ids: (string | null | undefined)[]) => {
    setAllowed((prev) => {
      const next = new Set(prev);
      for (const id of ids) if (id) next.add(id);
      try { sessionStorage.setItem(ALLOW_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ blurred, toggle, allowed, allow }}>
      {children}
      {blurred && (
        <div style={{
          position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 260,
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 100,
          background: '#0A0A0A', color: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,.35)',
          fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <EyeOff size={14} color="var(--accent)" />
          <span>Blur-Modus aktiv — Kundendaten sind ausgeblendet</span>
          <button onClick={toggle} title="Blur-Modus beenden" style={{
            display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4, padding: '5px 11px', borderRadius: 100,
            background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}><X size={12} /> Beenden</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(Ctx);
  /** true, wenn dieser Inhalt gerade versteckt werden soll (Whitelist: im Blur-Modus Erstelltes bleibt sichtbar). */
  const isHidden = useCallback(
    (id?: string | null) => ctx.blurred && !(id && ctx.allowed.has(id)),
    [ctx.blurred, ctx.allowed],
  );
  /** Blur-Style für kundenbezogene Zeilen/Karten — unlesbar und unklickbar. */
  const hideStyle = useCallback(
    (id?: string | null): React.CSSProperties =>
      ctx.blurred && !(id && ctx.allowed.has(id)) ? { filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.75 } : {},
    [ctx.blurred, ctx.allowed],
  );
  return { ...ctx, isHidden, hideStyle };
}

/** Sidebar-Umschalter (dunkles Theme) — sitzt bei den unteren Utility-Einträgen. */
export function SidebarBlurToggle({ collapsed }: { collapsed: boolean }) {
  const { blurred, toggle } = usePrivacy();
  const Icon = blurred ? Eye : EyeOff;
  return (
    <button
      onClick={toggle}
      title={blurred ? 'Blur-Modus beenden' : 'Blur-Modus: Kundendaten ausblenden'}
      style={{
        display: 'flex', alignItems: 'center', width: '100%',
        gap: collapsed ? 0 : 11,
        padding: collapsed ? '11px 14px' : '11px 12px',
        borderRadius: 12, border: 'none', cursor: 'pointer',
        fontSize: 13.5, fontWeight: blurred ? 600 : 500, fontFamily: 'inherit',
        color: blurred ? 'var(--accent)' : 'rgba(255,255,255,.45)',
        background: blurred ? 'rgba(255,255,255,.08)' : 'transparent',
        minHeight: 44, textAlign: 'left',
        transition: 'background .12s, color .12s',
      }}
      onMouseEnter={(e) => { if (!blurred) { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.8)'; } }}
      onMouseLeave={(e) => { if (!blurred) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.45)'; } }}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{blurred ? 'Blur beenden' : 'Blur-Modus'}</span>}
    </button>
  );
}
