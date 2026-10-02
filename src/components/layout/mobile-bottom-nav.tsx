'use client';

import { useState, useEffect, useCallback } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import {
  LayoutGrid, FolderKanban, ListChecks, Users, UserCog, Receipt, FileSignature, Settings,
  FileText, UserCircle, Menu, X, LogOut, Loader2, MessageSquarePlus, Calendar, Timer, Target, Repeat,
  type LucideIcon,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';

const E = 'cubic-bezier(.16,1,.3,1)';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Nur anzeigen, wenn der Nutzer dieses Recht hat (agency-Variante). */
  perm?: string;
}

interface Props {
  variant: 'agency' | 'portal';
  slug?: string;
  agencyName: string;
  agencyLogo?: string | null;
  accountName: string;
  accountSub?: string | null;
  avatarUrl?: string | null;
  avatarFrameColor?: string | null;
  /** Permission-Keys der Session (agency) — filtert die Einträge z. B. für Mitarbeiter. */
  permissions?: string[];
}

/**
 * Right-thumb mobile navigation: a FLOATING bottom bar (inset island) with the
 * primary destinations + a Menü button that slides up a floating bottom-drawer
 * sheet holding the full nav and the account/logout. Replaces the top-left
 * hamburger + off-canvas sidebar on mobile (≤860px, see globals.css).
 *
 * Tapping a destination shows an instant in-place spinner (`useLinkStatus`) so a
 * navigation never feels dead while the server round-trips.
 */

/** Bar item visuals — lives inside <Link> so it can read the per-link pending state. */
function BarItemVisual({ Icon, label, active }: { Icon: LucideIcon; label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  const lit = active || pending;
  return (
    <span style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 4, width: '100%', height: '100%',
      color: lit ? 'var(--accent)' : 'rgba(255,255,255,.55)',
      transition: `color .18s ${E}`,
    }}>
      {active && !pending && (
        <span aria-hidden style={{
          position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)',
          width: 16, height: 3, borderRadius: 3, background: 'var(--accent)',
        }} />
      )}
      {pending
        ? <Loader2 size={21} className="cos-spin" style={{ flexShrink: 0 }} />
        : <Icon key={active ? 'on' : 'off'} className={active ? 'cos-nav-pop' : undefined} size={21} strokeWidth={lit ? 2.4 : 2} style={{ flexShrink: 0 }} />}
      <span style={{
        fontSize: 10, fontWeight: lit ? 700 : 600, letterSpacing: '.005em',
        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
    </span>
  );
}

/** Sheet row visuals — pending-aware spinner so taps inside the sheet feel instant too. */
function SheetRowVisual({ Icon, label, active }: { Icon: LucideIcon; label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending
        ? <Loader2 size={19} className="cos-spin" style={{ flexShrink: 0, color: active ? '#000' : 'var(--accent)' }} />
        : <Icon key={active ? 'on' : 'off'} className={active ? 'cos-nav-pop' : undefined} size={19} strokeWidth={active ? 2.4 : 2} style={{ flexShrink: 0 }} />}
      <span>{label}</span>
    </>
  );
}

export function MobileBottomNav({
  variant, slug, agencyName, agencyLogo,
  accountName, accountSub, avatarUrl, avatarFrameColor, permissions,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const base = `/app/p/${slug}`;
  const can = (perm?: string) => !perm || !permissions || permissions.includes(perm);
  // Spiegelt die Desktop-Sidebar: erst die 4 Primär-Ziele (Bar), Rest im Sheet.
  const ALL_ITEMS: NavItem[] = variant === 'agency'
    ? [
        { label: 'Dashboard', href: '/app/a/dashboard', icon: LayoutGrid },
        { label: 'Projekte', href: '/app/a/projects', icon: FolderKanban, perm: 'projects:view' },
        { label: 'Aufgaben', href: '/app/a/tasks', icon: ListChecks, perm: 'projects:view' },
        { label: 'Kunden', href: '/app/a/clients', icon: Users, perm: 'clients:view' },
        { label: 'Leads', href: '/app/a/leads', icon: Target, perm: 'leads:view' },
        { label: 'Termine', href: '/app/a/appointments', icon: Calendar },
        { label: 'Zeiterfassung', href: '/app/a/time', icon: Timer },
        { label: 'Angebote', href: '/app/a/proposals', icon: FileSignature, perm: 'invoices:view' },
        { label: 'Rechnungen', href: '/app/a/invoices', icon: Receipt, perm: 'invoices:view' },
        { label: 'Wiederkehrend', href: '/app/a/recurring', icon: Repeat, perm: 'invoices:create' },
        { label: 'Team', href: '/app/a/team', icon: UserCog },
        { label: 'Einstellungen', href: '/app/a/settings', icon: Settings, perm: 'settings:profile' },
      ]
    : [
        { label: 'Übersicht', href: base, icon: LayoutGrid, exact: true },
        { label: 'Projekte', href: `${base}/projekte`, icon: FolderKanban },
        { label: 'Dateien', href: `${base}/dateien`, icon: FileText },
        { label: 'Termine', href: `${base}/termine`, icon: Calendar },
        { label: 'Angebote', href: `${base}/angebote`, icon: FileSignature },
        { label: 'Rechnungen', href: `${base}/rechnungen`, icon: Receipt },
        { label: 'Profil', href: `${base}/profil`, icon: UserCircle },
      ];
  const NAV = ALL_ITEMS.filter((it) => variant !== 'agency' || can(it.perm));

  const accountHref = variant === 'agency'
    ? (can('settings:profile') ? '/app/a/settings' : '/app/a/dashboard')
    : `${base}/profil`;
  const PRIMARY = 4;
  const primary = NAV.slice(0, PRIMARY);

  const isActive = (it: NavItem) =>
    it.exact ? pathname === it.href : (pathname === it.href || pathname.startsWith(it.href + '/'));
  const activeIdx = NAV.findIndex(isActive);
  const menuActive = open || activeIdx >= PRIMARY;

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (open) {
      setRender(true);
      document.body.classList.add('cos-overlay-open');
      document.body.style.overflow = 'hidden';
    } else if (render) {
      setShown(false);
      document.body.classList.remove('cos-overlay-open');
      document.body.style.overflow = '';
      const t = setTimeout(() => setRender(false), 440);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!render) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(r);
  }, [render]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  useEffect(() => () => {
    document.body.classList.remove('cos-overlay-open');
    document.body.style.overflow = '';
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try { await authClient.signOut(); } catch { /* ignore */ }
    router.push('/app/a/login');
  }

  const accentText = '#fff';

  return (
    <>
      {/* ───────────────── Floating bottom bar ───────────────── */}
      <nav
        className="cos-bottom-nav"
        aria-label="Hauptnavigation"
        style={{
          position: 'fixed', left: 14, right: 14, bottom: 'calc(14px + env(safe-area-inset-bottom))',
          margin: '0 auto', maxWidth: 460, zIndex: 40,
          padding: '8px 8px',
          background: 'rgba(20,20,20,.82)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.4)', backdropFilter: 'blur(22px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 26,
          boxShadow: '0 16px 44px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.3)',
          alignItems: 'stretch', gap: 2,
          animation: `cosBnIn .55s ${E} both`,
        }}
      >
        {primary.map((it) => {
          const active = isActive(it);
          return (
            <Link
              key={it.href}
              href={it.href}
              prefetch
              className="cos-bn-tap"
              aria-current={active ? 'page' : undefined}
              style={{
                position: 'relative', flex: 1, minWidth: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px 2px', borderRadius: 18, textDecoration: 'none',
                background: active ? 'rgba(var(--accent-rgb),.16)' : 'transparent',
                transition: `background .2s ${E}, transform .12s ${E}`,
              }}
            >
              <BarItemVisual Icon={it.icon} label={it.label} active={active} />
            </Link>
          );
        })}

        {/* Menü → opens the bottom sheet */}
        <button
          className="cos-bn-tap"
          aria-label="Menü öffnen"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          style={{
            position: 'relative', flex: 1, minWidth: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '8px 2px', borderRadius: 18, border: 'none', cursor: 'pointer',
            color: menuActive ? 'var(--accent)' : 'rgba(255,255,255,.55)',
            background: menuActive ? 'rgba(var(--accent-rgb),.16)' : 'transparent',
            transition: `color .18s ${E}, background .2s ${E}, transform .12s ${E}`,
          }}
        >
          <Menu key={menuActive ? 'on' : 'off'} className={menuActive ? 'cos-nav-pop' : undefined} size={21} strokeWidth={menuActive ? 2.4 : 2} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: menuActive ? 700 : 600, letterSpacing: '.005em' }}>Menü</span>
        </button>
      </nav>

      {/* ───────────────── Floating bottom-drawer sheet ───────────────── */}
      {render && (
        <>
          <div
            onClick={close}
            aria-hidden
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(8,8,8,.55)',
              WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)',
              opacity: shown ? 1 : 0, transition: `opacity .3s ${E}`,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            style={{
              position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))',
              margin: '0 auto', maxWidth: 480, zIndex: 51,
              maxHeight: '82vh', display: 'flex', flexDirection: 'column',
              background: '#161616',
              borderRadius: 28,
              border: '1px solid rgba(255,255,255,.1)',
              boxShadow: '0 -24px 70px rgba(0,0,0,.55), 0 8px 24px rgba(0,0,0,.4)',
              padding: '10px 12px 14px',
              transform: shown ? 'translateY(0)' : 'translateY(106%)',
              transition: `transform .44s ${E}`,
              overflowY: 'auto',
            }}
          >
            <div aria-hidden style={{ width: 40, height: 4, borderRadius: 4, background: 'rgba(255,255,255,.2)', margin: '4px auto 12px', flexShrink: 0 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 6px 14px', flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                background: agencyLogo ? `center/cover url(${agencyLogo})` : (variant === 'agency' ? '#fff' : 'var(--accent)'),
                color: variant === 'agency' ? '#000' : accentText,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900,
              }}>
                {!agencyLogo && (agencyName.charAt(0) || 'C').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'rgba(255,255,255,.92)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agencyName}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.34)' }}>{variant === 'agency' ? 'Kundenportal' : 'Mein Portal'}</div>
              </div>
              <button
                onClick={close}
                aria-label="Schließen"
                className="cos-bn-tap"
                style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              {NAV.map((it) => {
                const active = isActive(it);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    prefetch
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className="cos-bn-tap"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      padding: '13px 14px', borderRadius: 14, minHeight: 52, textDecoration: 'none',
                      fontSize: 15, fontWeight: active ? 700 : 500,
                      color: active ? '#000' : 'rgba(255,255,255,.64)',
                      background: active ? '#fff' : 'transparent',
                      transition: `background .16s ${E}, color .16s ${E}, transform .12s ${E}`,
                    }}
                  >
                    <SheetRowVisual Icon={it.icon} label={it.label} active={active} />
                  </Link>
                );
              })}
            </div>

            {/* Feedback (agency users give product feedback) */}
            {variant === 'agency' && (
              <button
                onClick={() => { close(); window.setTimeout(() => window.dispatchEvent(new Event('cos:open-feedback')), 460); }}
                className="cos-bn-tap"
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, marginTop: 8, width: '100%',
                  padding: '13px 14px', borderRadius: 14, minHeight: 52, cursor: 'pointer',
                  border: 'none', textAlign: 'left',
                  fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.92)',
                  background: 'rgba(255,255,255,.09)',
                  transition: `transform .12s ${E}`,
                }}
              >
                <MessageSquarePlus size={19} style={{ flexShrink: 0 }} />
                <span>Feedback geben</span>
              </button>
            )}

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Link
                href={accountHref}
                prefetch
                onClick={close}
                className="cos-bn-tap"
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '8px 8px', borderRadius: 12, textDecoration: 'none' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: avatarFrameColor || 'rgba(255,255,255,.15)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : getInitials(accountName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{accountName}</div>
                  {accountSub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.36)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>{accountSub}</div>}
                </div>
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="cos-bn-tap"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                  padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)',
                  fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
                  opacity: loggingOut ? 0.5 : 1,
                }}
              >
                {loggingOut ? <Loader2 size={16} className="cos-spin" /> : <LogOut size={16} />} Abmelden
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
