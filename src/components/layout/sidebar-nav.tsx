'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import {
  LayoutGrid, FolderKanban, ListChecks, Calendar, Users, UserCog, Receipt, FileSignature, Settings, Repeat, Timer, Target,
  ChevronLeft, ChevronRight, LogOut, MessageSquarePlus, type LucideIcon,
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { SidebarBlurToggle } from '@/components/privacy/privacy-mode';

interface NavItem { label: string; href: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavItem[] }

/** Grouped agency navigation — same structure language as the settings nav. */
const NAV_GROUPS: NavGroup[] = [
  { label: 'Übersicht', items: [
    { label: 'Dashboard', href: '/app/a/dashboard', icon: LayoutGrid },
  ] },
  { label: 'Arbeit', items: [
    { label: 'Projekte', href: '/app/a/projects', icon: FolderKanban },
    { label: 'Aufgaben', href: '/app/a/tasks', icon: ListChecks },
    { label: 'Termine', href: '/app/a/appointments', icon: Calendar },
    { label: 'Zeiterfassung', href: '/app/a/time', icon: Timer },
  ] },
  { label: 'Kontakte', items: [
    { label: 'Leads', href: '/app/a/leads', icon: Target },
    { label: 'Kunden', href: '/app/a/clients', icon: Users },
    { label: 'Team', href: '/app/a/team', icon: UserCog },
  ] },
  { label: 'Finanzen', items: [
    { label: 'Angebote', href: '/app/a/proposals', icon: FileSignature },
    { label: 'Rechnungen', href: '/app/a/invoices', icon: Receipt },
    { label: 'Wiederkehrend', href: '/app/a/recurring', icon: Repeat },
  ] },
];
/** Einstellungen lives pinned at the bottom (utility), not inside a work group. */
const SETTINGS_ITEM: NavItem = { label: 'Einstellungen', href: '/app/a/settings', icon: Settings };

const E = 'cubic-bezier(.16,1,.3,1)';
const DUR = `.32s`;
const DUR_FAST = `.16s`;
const REVEAL = (c: boolean): React.CSSProperties => ({
  maxWidth: c ? 0 : 200,
  opacity: c ? 0 : 1,
  overflow: 'hidden',
  flexShrink: 0,
  whiteSpace: 'nowrap' as const,
  transition: `max-width ${DUR} ${E}, opacity ${c ? DUR_FAST : DUR} ${E}`,
});

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

/** A single navigation row — shared by the groups and the pinned Einstellungen. */
function NavRow({ item, collapsed, active, onNavigate }: {
  item: NavItem; collapsed: boolean; active: boolean; onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 11,
        padding: collapsed ? '11px 14px' : '11px 12px',
        borderRadius: 12,
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        color: active ? '#000' : 'rgba(255,255,255,.45)',
        background: active ? '#fff' : 'transparent',
        minHeight: 44,
        textDecoration: 'none',
        transition: `background .12s, color .12s, gap ${DUR} ${E}, padding ${DUR} ${E}`,
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.8)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.45)'; } }}
    >
      <Icon key={active ? 'on' : 'off'} className={active ? 'cos-nav-pop' : undefined} size={16} style={{ flexShrink: 0 }} />
      <span style={REVEAL(collapsed)}>{item.label}</span>
    </Link>
  );
}

interface SidebarNavProps {
  agencyName: string;
  userName: string;
  userEmail: string;
  logoUrl?: string | null;
}

export function SidebarNav({ agencyName, userName, userEmail, logoUrl }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Mobile off-canvas: toggle from the header hamburger, auto-close on navigate.
  useEffect(() => {
    const onToggle = () => setMobileOpen((o) => !o);
    window.addEventListener('cos:toggle-nav', onToggle);
    return () => window.removeEventListener('cos:toggle-nav', onToggle);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const logoLetter = (agencyName.charAt(0) || 'C').toUpperCase();
  const initials = getInitials(userName) || logoLetter;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.style.setProperty('--current-sw', next ? 'var(--sc)' : 'var(--sw)');
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authClient.signOut();
    } catch { /* ignore */ }
    router.push('/app/a/login');
  }

  return (
    <>
    <div className="app-sidebar-backdrop" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />
    <aside className="app-sidebar" data-open={mobileOpen} style={{
      width: collapsed ? 'var(--sc)' : 'var(--sw)',
      background: '#111111',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 20,
      boxShadow: '0 8px 40px rgba(0,0,0,.22)',
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 12, top: 12, bottom: 12,
      zIndex: 10,
      overflow: 'hidden',
      transition: `width ${DUR} ${E}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, minHeight: 32 }}>
        <div
          onClick={collapsed ? toggle : undefined}
          onMouseEnter={() => collapsed && setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
          title={collapsed ? 'Navigation ausklappen' : undefined}
          style={{
            position: 'relative',
            width: collapsed ? 44 : 32,
            height: collapsed ? 44 : 32,
            borderRadius: collapsed ? 13 : 10,
            background: logoUrl ? `center/cover url(${logoUrl})` : '#fff',
            color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: collapsed ? 16 : 13, fontWeight: 900, flexShrink: 0,
            cursor: collapsed ? 'pointer' : 'default',
            userSelect: 'none',
            overflow: 'visible',
            transition: `width ${DUR} ${E}, height ${DUR} ${E}, border-radius ${DUR} ${E}, font-size ${DUR} ${E}`,
          }}
        >
          {/* Brand letter (no custom logo) — stays visible in both states */}
          {!logoUrl && <span>{logoLetter}</span>}

          {/* Collapsed-only hover scrim (logo agencies): darken so the white arrow reads on any logo */}
          {logoUrl && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 13,
              background: 'rgba(10,10,10,.55)',
              opacity: collapsed && logoHover ? 1 : 0,
              pointerEvents: 'none',
              transition: `opacity ${DUR_FAST} ${E}`,
            }} />
          )}

          {/* Persistent expand badge — ALWAYS visible when collapsed (not hover-gated) */}
          <div style={{
            position: 'absolute', right: -4, bottom: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #111111',
            boxShadow: '0 2px 8px rgba(0,0,0,.45)',
            opacity: collapsed ? 1 : 0,
            transform: collapsed ? (logoHover ? 'scale(1.16)' : 'scale(1)') : 'scale(.4)',
            pointerEvents: 'none',
            transition: `opacity ${DUR} ${E}, transform ${DUR_FAST} ${E}`,
          }}>
            <ChevronRight size={11} strokeWidth={2.6} />
          </div>
        </div>

        <div style={{ ...REVEAL(collapsed), flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agencyName}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(255,255,255,.32)', whiteSpace: 'nowrap' }}>
            Kundenportal
          </div>
        </div>

        <div className="cos-desktop-only" style={{ width: collapsed ? 0 : 32, overflow: 'hidden', flexShrink: 0, transition: `width ${DUR} ${E}` }}>
          <button
            onClick={toggle}
            aria-label="Navigation einklappen"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,.4)',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.14)'; e.currentTarget.style.color = 'rgba(255,255,255,.75)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.4)'; }}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Grouped nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {/* Between groups: a divider when collapsed (replaces the hidden label) */}
            {gi > 0 && (
              <div style={{ overflow: 'hidden', maxHeight: collapsed ? 15 : 0, opacity: collapsed ? 1 : 0, transition: `max-height ${DUR} ${E}, opacity ${DUR} ${E}` }}>
                <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '7px 12px' }} />
              </div>
            )}
            {/* Group label when expanded */}
            <div style={{ overflow: 'hidden', maxHeight: collapsed ? 0 : 30, opacity: collapsed ? 0 : 1, transition: `max-height ${DUR} ${E}, opacity ${collapsed ? DUR_FAST : DUR} ${E}` }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.12em', color: 'rgba(255,255,255,.25)', padding: gi === 0 ? '2px 12px 6px' : '12px 12px 6px', whiteSpace: 'nowrap' }}>
                {group.label}
              </span>
            </div>
            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} collapsed={collapsed} active={isActivePath(pathname, item.href)} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Einstellungen — pinned utility, separated from the work groups */}
      <div style={{ marginTop: 10, marginBottom: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <SidebarBlurToggle collapsed={collapsed} />
        <NavRow item={SETTINGS_ITEM} collapsed={collapsed} active={isActivePath(pathname, SETTINGS_ITEM.href)} onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Feedback entry — agency users give product feedback */}
      <button
        onClick={() => window.dispatchEvent(new Event('cos:open-feedback'))}
        title="Feedback geben"
        style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 11,
          padding: collapsed ? '11px 14px' : '11px 12px',
          marginBottom: 8, width: '100%', cursor: 'pointer', border: 'none', textAlign: 'left',
          borderRadius: 12, minHeight: 44, fontSize: 13.5, fontWeight: 600,
          color: 'rgba(255,255,255,.82)', background: 'rgba(255,255,255,.07)',
          transition: `background .12s, color .12s, gap ${DUR} ${E}, padding ${DUR} ${E}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.13)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.82)'; }}
      >
        <MessageSquarePlus size={16} style={{ flexShrink: 0 }} />
        <span style={REVEAL(collapsed)}>Feedback</span>
      </button>

      {/* Footer: profile + logout */}
      <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Link href="/app/a/settings" onClick={() => setMobileOpen(false)} style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 9,
          padding: collapsed ? '9px 9px' : '9px 8px',
          borderRadius: 10, cursor: 'pointer', textDecoration: 'none',
          transition: `background .12s, gap ${DUR} ${E}, padding ${DUR} ${E}`,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={REVEAL(collapsed)}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {userName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.32)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {userEmail}
            </div>
          </div>
        </Link>
        {!collapsed && (
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Abmelden"
            style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .12s, color .12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'rgba(255,255,255,.4)'; }}
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
    </>
  );
}
