'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCog,
  Receipt,
  Settings,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { globalSearch, type SearchResult, type SearchItem } from './search-actions';

/* ─── Static navigation quick-links ─── */
interface NavLink {
  label: string;
  href: string;
  icon: ReactNode;
  keywords: string;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '/app/a/dashboard', icon: <LayoutDashboard size={15} />, keywords: 'dashboard start übersicht home' },
  { label: 'Projekte', href: '/app/a/projects', icon: <FolderKanban size={15} />, keywords: 'projekte projects aufträge' },
  { label: 'Kunden', href: '/app/a/clients', icon: <Users size={15} />, keywords: 'kunden clients kontakte' },
  { label: 'Team', href: '/app/a/team', icon: <UserCog size={15} />, keywords: 'team mitarbeiter user' },
  { label: 'Rechnungen', href: '/app/a/invoices', icon: <Receipt size={15} />, keywords: 'rechnungen invoices abrechnung' },
  { label: 'Einstellungen', href: '/app/a/settings', icon: <Settings size={15} />, keywords: 'einstellungen settings konfiguration white-label' },
];

/* ─── Group icon mapping for search results ─── */
function groupIcon(key: string): ReactNode {
  switch (key) {
    case 'projects': return <FolderKanban size={15} />;
    case 'clients': return <Users size={15} />;
    case 'invoices': return <Receipt size={15} />;
    case 'team': return <UserCog size={15} />;
    default: return <Search size={15} />;
  }
}

/* A flattened, selectable row in the rendered list. */
interface FlatRow {
  href: string;
  title: string;
  subtitle: string | null;
  icon: ReactNode;
}

/* A visual section (group header + its rows) for rendering. */
interface RenderGroup {
  key: string;
  label: string;
  rows: FlatRow[];
}

const DEBOUNCE_MS = 180;

export function CommandPalette() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult>({ groups: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reqId = useRef(0);

  useEffect(() => setMounted(true), []);

  /* ─── Open / close ─── */
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResult({ groups: [] });
    setActive(0);
    setLoading(false);
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);

  /* Global hotkey (Cmd/Ctrl+K) + custom event trigger. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('cos:open-search', onCustom);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('cos:open-search', onCustom);
    };
  }, []);

  /* Lock body scroll + autofocus while open. */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('cos-overlay-open');
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('cos-overlay-open');
      window.clearTimeout(t);
    };
  }, [open]);

  /* ─── Debounced search ─── */
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResult({ groups: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const myId = ++reqId.current;
    const handle = window.setTimeout(async () => {
      try {
        const res = await globalSearch(q);
        if (myId === reqId.current) {
          setResult(res);
          setLoading(false);
        }
      } catch {
        if (myId === reqId.current) {
          setResult({ groups: [] });
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  /* ─── Build render groups: filtered navigation + search results ─── */
  const navRows = useMemo<FlatRow[]>(() => {
    const q = query.trim().toLowerCase();
    return NAV_LINKS
      .filter((l) => q.length === 0 || l.label.toLowerCase().includes(q) || l.keywords.includes(q))
      .map((l) => ({ href: l.href, title: l.label, subtitle: null, icon: l.icon }));
  }, [query]);

  const renderGroups = useMemo<RenderGroup[]>(() => {
    const groups: RenderGroup[] = [];
    if (navRows.length > 0) {
      groups.push({ key: 'nav', label: 'Navigation', rows: navRows });
    }
    for (const g of result.groups) {
      const rows: FlatRow[] = g.items.map((it: SearchItem) => ({
        href: it.href,
        title: it.title,
        subtitle: it.subtitle,
        icon: groupIcon(g.key),
      }));
      if (rows.length > 0) groups.push({ key: g.key, label: g.label, rows });
    }
    return groups;
  }, [navRows, result]);

  /* Flatten for keyboard navigation; each row gets a stable global index. */
  const flatRows = useMemo<FlatRow[]>(() => renderGroups.flatMap((g) => g.rows), [renderGroups]);

  /* Reset highlight to top whenever the result set changes. */
  useEffect(() => {
    setActive(0);
  }, [flatRows.length, query]);

  const go = useCallback((href: string) => {
    close();
    router.push(href);
  }, [close, router]);

  /* ─── Keyboard nav inside the palette ─── */
  const onInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flatRows.length === 0 ? 0 : (i + 1) % flatRows.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flatRows.length === 0 ? 0 : (i - 1 + flatRows.length) % flatRows.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = flatRows[active];
      if (row) go(row.href);
    }
  }, [flatRows, active, close, go]);

  /* Keep the active row scrolled into view. */
  useEffect(() => {
    if (!open) return;
    const el = rowRefs.current[active];
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!mounted || !open) return null;

  const q = query.trim();
  const hasQuery = q.length > 0;
  const showEmpty = hasQuery && !loading && flatRows.length === 0;

  /* Running counter so each rendered row maps to its flat index. */
  let cursor = -1;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(10,10,10,.42)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 20px 20px',
        animation: 'overlayIn .2s cubic-bezier(.16,1,.3,1)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Befehlspalette"
        style={{
          width: '100%',
          maxWidth: 600,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 28px 90px rgba(0,0,0,.34)',
          border: '1px solid #E4E3DF',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'min(560px, calc(100dvh - 14dvh - 40px))',
          overflow: 'hidden',
          animation: 'modalIn .28s cubic-bezier(.16,1,.3,1)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ─── Search input row ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 18px',
            borderBottom: '1px solid #E4E3DF',
            flexShrink: 0,
          }}
        >
          <Search size={18} style={{ color: '#909090', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Suchen oder springen zu…"
            aria-label="Suche"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              fontWeight: 500,
              color: '#0A0A0A',
              fontFamily: 'inherit',
            }}
          />
          {loading && (
            <span
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid #E4E3DF',
                borderTopColor: 'var(--accent)',
                animation: 'spin .7s linear infinite',
                flexShrink: 0,
              }}
            />
          )}
          <kbd
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#909090',
              background: '#F4F3F0',
              border: '1px solid #E4E3DF',
              borderRadius: 7,
              padding: '3px 7px',
              fontFamily: 'inherit',
              flexShrink: 0,
              letterSpacing: '.5px',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* ─── Results list ─── */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            padding: '8px 8px',
            flex: 1,
          }}
        >
          {showEmpty ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#909090',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, color: '#505050', marginBottom: 4 }}>Keine Treffer</div>
              <div style={{ fontSize: 13 }}>Für „{q}" wurde nichts gefunden.</div>
            </div>
          ) : (
            renderGroups.map((group) => (
              <div key={group.key} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '.6px',
                    textTransform: 'uppercase',
                    color: '#909090',
                    padding: '8px 12px 4px',
                    userSelect: 'none',
                  }}
                >
                  {group.label}
                </div>
                {group.rows.map((row) => {
                  cursor += 1;
                  const idx = cursor;
                  const isActive = idx === active;
                  return (
                    <button
                      key={`${group.key}-${row.href}-${idx}`}
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onMouseMove={() => setActive(idx)}
                      onClick={() => go(row.href)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: isActive ? '#0A0A0A' : 'transparent',
                        color: isActive ? '#fff' : '#0A0A0A',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background .12s cubic-bezier(.16,1,.3,1), color .12s cubic-bezier(.16,1,.3,1)',
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          background: isActive ? 'rgba(255,255,255,.14)' : '#F4F3F0',
                          color: isActive ? '#fff' : '#505050',
                        }}
                      >
                        {row.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {row.title}
                        </span>
                        {row.subtitle && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 12,
                              marginTop: 1,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: isActive ? 'rgba(255,255,255,.6)' : '#909090',
                            }}
                          >
                            {row.subtitle}
                          </span>
                        )}
                      </span>
                      {isActive && (
                        <span
                          aria-hidden
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'rgba(255,255,255,.7)',
                            flexShrink: 0,
                          }}
                        >
                          <CornerDownLeft size={13} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}

          {/* Idle hint when nothing is typed yet. */}
          {!hasQuery && (
            <div
              style={{
                padding: '10px 12px 6px',
                fontSize: 12.5,
                color: '#b0aea8',
                lineHeight: 1.5,
              }}
            >
              Tippen Sie, um Projekte, Kunden, Rechnungen und Team zu durchsuchen.
            </div>
          )}
        </div>

        {/* ─── Footer hints ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 16px',
            borderTop: '1px solid #E4E3DF',
            background: '#F4F3F0',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#909090', fontWeight: 500 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <Hint><ArrowUp size={11} /></Hint>
                <Hint><ArrowDown size={11} /></Hint>
              </span>
              navigieren
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Hint><CornerDownLeft size={11} /></Hint>
              öffnen
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Hint>esc</Hint>
              schließen
            </span>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#505050',
              background: '#fff',
              border: '1px solid #E4E3DF',
              borderRadius: 7,
              padding: '3px 8px',
              letterSpacing: '.5px',
            }}
          >
            ⌘K
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* Small keycap used in the footer hint row. */
function Hint({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 4px',
        fontSize: 11,
        fontWeight: 700,
        color: '#505050',
        background: '#fff',
        border: '1px solid #E4E3DF',
        borderRadius: 5,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {children}
    </kbd>
  );
}
