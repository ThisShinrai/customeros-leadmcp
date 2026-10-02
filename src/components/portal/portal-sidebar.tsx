'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { LayoutGrid, FolderKanban, FileText, Calendar, Receipt, FileSignature, UserCircle, ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';
import { getInitials } from '@/lib/utils';

const E = 'cubic-bezier(.16,1,.3,1)';
const DUR = '.32s';
const DUR_FAST = '.16s';
const REVEAL = (c: boolean): React.CSSProperties => ({ maxWidth: c ? 0 : 200, opacity: c ? 0 : 1, overflow: 'hidden', flexShrink: 0, whiteSpace: 'nowrap', transition: `max-width ${DUR} ${E}, opacity ${c ? DUR_FAST : DUR} ${E}` });

interface NavItem { label: string; href: string; icon: LucideIcon; exact?: boolean }

function NavRow({ item, collapsed, active, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link key={item.href} href={item.href} onClick={onNavigate} title={collapsed ? item.label : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11, padding: collapsed ? '11px 14px' : '11px 12px', borderRadius: 12, fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? '#000' : 'rgba(255,255,255,.45)', background: active ? '#fff' : 'transparent', minHeight: 44, textDecoration: 'none', transition: `background .12s, color .12s, gap ${DUR} ${E}, padding ${DUR} ${E}` }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.8)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.45)'; } }}>
      <Icon key={active ? 'on' : 'off'} className={active ? 'cos-nav-pop' : undefined} size={16} style={{ flexShrink: 0 }} />
      <span style={REVEAL(collapsed)}>{item.label}</span>
    </Link>
  );
}

interface Props {
  slug: string;
  agencyName: string;
  agencyLogo: string | null;
  clientName: string;
  clientCompany: string | null;
  avatarUrl: string | null;
  avatarFrameColor: string | null;
}

export function PortalSidebar({ slug, agencyName, agencyLogo, clientName, clientCompany, avatarUrl, avatarFrameColor }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const base = `/app/p/${slug}`;

  // Mobile off-canvas: toggle from the header hamburger, auto-close on navigate.
  useEffect(() => {
    const onToggle = () => setMobileOpen((o) => !o);
    window.addEventListener('cos:toggle-nav', onToggle);
    return () => window.removeEventListener('cos:toggle-nav', onToggle);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    { label: 'Mein Portal', items: [
      { label: 'Übersicht', href: base, icon: LayoutGrid, exact: true },
      { label: 'Projekte', href: `${base}/projekte`, icon: FolderKanban },
      { label: 'Dateien', href: `${base}/dateien`, icon: FileText },
      { label: 'Termine', href: `${base}/termine`, icon: Calendar },
    ] },
    { label: 'Finanzen', items: [
      { label: 'Angebote', href: `${base}/angebote`, icon: FileSignature },
      { label: 'Rechnungen', href: `${base}/rechnungen`, icon: Receipt },
    ] },
  ];
  const PROFILE_ITEM: NavItem = { label: 'Profil', href: `${base}/profil`, icon: UserCircle };

  const isActive = (item: NavItem) => item.exact ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + '/'));

  function toggle() {
    const n = !collapsed; setCollapsed(n);
    document.documentElement.style.setProperty('--current-sw', n ? 'var(--sc)' : 'var(--sw)');
  }
  async function logout() { try { await authClient.signOut(); } catch {} router.push('/app/a/login'); }

  return (
    <>
    <div className="app-sidebar-backdrop" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />
    <aside className="app-sidebar" data-open={mobileOpen} style={{ width: collapsed ? 'var(--sc)' : 'var(--sw)', background: '#111111', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,.22)', padding: '16px 12px', display: 'flex', flexDirection: 'column', position: 'fixed', left: 12, top: 12, bottom: 12, zIndex: 10, overflow: 'hidden', transition: `width ${DUR} ${E}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, minHeight: 32 }}>
        <div onClick={collapsed ? toggle : undefined} onMouseEnter={() => collapsed && setLogoHover(true)} onMouseLeave={() => setLogoHover(false)} title={collapsed ? 'Navigation ausklappen' : undefined}
          style={{ position: 'relative', width: collapsed ? 44 : 32, height: collapsed ? 44 : 32, borderRadius: collapsed ? 13 : 10, background: agencyLogo ? `center/cover url(${agencyLogo})` : 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: collapsed ? 16 : 13, fontWeight: 900, flexShrink: 0, cursor: collapsed ? 'pointer' : 'default', overflow: 'visible', transition: `width ${DUR} ${E}, height ${DUR} ${E}, border-radius ${DUR} ${E}, font-size ${DUR} ${E}` }}>
          {!agencyLogo && <span>{(agencyName[0] || 'C').toUpperCase()}</span>}
          {/* Collapsed-only hover scrim (logo agencies) */}
          {agencyLogo && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 13, background: 'rgba(10,10,10,.55)', opacity: collapsed && logoHover ? 1 : 0, pointerEvents: 'none', transition: `opacity ${DUR_FAST} ${E}` }} />
          )}
          {/* Persistent expand badge — ALWAYS visible when collapsed (not hover-gated) */}
          <div style={{ position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: '50%', background: '#fff', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #111111', boxShadow: '0 2px 8px rgba(0,0,0,.45)', opacity: collapsed ? 1 : 0, transform: collapsed ? (logoHover ? 'scale(1.16)' : 'scale(1)') : 'scale(.4)', pointerEvents: 'none', transition: `opacity ${DUR} ${E}, transform ${DUR_FAST} ${E}` }}>
            <ChevronRight size={11} strokeWidth={2.8} />
          </div>
        </div>
        <div style={{ ...REVEAL(collapsed), flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agencyName}</div>
          <div style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(255,255,255,.32)' }}>Kundenportal</div>
        </div>
        <div className="cos-desktop-only" style={{ width: collapsed ? 0 : 32, overflow: 'hidden', flexShrink: 0, transition: `width ${DUR} ${E}` }}>
          <button onClick={toggle} aria-label="Navigation einklappen" style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.4)', transition: 'background .12s, color .12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.14)'; e.currentTarget.style.color = 'rgba(255,255,255,.75)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.4)'; }}><ChevronLeft size={14} /></button>
        </div>
      </div>

      {/* Grouped nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && (
              <div style={{ overflow: 'hidden', maxHeight: collapsed ? 15 : 0, opacity: collapsed ? 1 : 0, transition: `max-height ${DUR} ${E}, opacity ${DUR} ${E}` }}>
                <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '7px 12px' }} />
              </div>
            )}
            <div style={{ overflow: 'hidden', maxHeight: collapsed ? 0 : 30, opacity: collapsed ? 0 : 1, transition: `max-height ${DUR} ${E}, opacity ${collapsed ? DUR_FAST : DUR} ${E}` }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.12em', color: 'rgba(255,255,255,.25)', padding: gi === 0 ? '2px 12px 6px' : '12px 12px 6px', whiteSpace: 'nowrap' }}>{group.label}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} collapsed={collapsed} active={isActive(item)} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profil — pinned utility */}
      <div style={{ marginTop: 10, marginBottom: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <NavRow item={PROFILE_ITEM} collapsed={collapsed} active={isActive(PROFILE_ITEM)} onNavigate={() => setMobileOpen(false)} />
      </div>

      <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Link href={`${base}/profil`} onClick={() => setMobileOpen(false)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9, padding: collapsed ? '9px 9px' : '9px 8px', borderRadius: 10, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarFrameColor || 'rgba(255,255,255,.15)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(clientName)}
          </div>
          <div style={REVEAL(collapsed)}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.32)', whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{clientCompany || 'Kunde'}</div>
          </div>
        </Link>
        {!collapsed && (
          <button onClick={logout} title="Abmelden" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,.4)'; }}><LogOut size={14} /></button>
        )}
      </div>
    </aside>
    </>
  );
}
