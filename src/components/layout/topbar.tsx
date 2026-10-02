'use client';

import { Search } from 'lucide-react';
import { useSession } from '@/lib/auth/client';
import { NotificationsBell } from '@/components/notifications';
import { NavToggle } from './nav-toggle';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { data: session } = useSession();
  const name     = session?.user?.name ?? '';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  return (
    <header className="cos-topbar" style={{
      background: '#fff',
      borderBottom: '1px solid #E4E3DF',
      height: 60,
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      {/* Left: hamburger (mobile) + title + subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <NavToggle />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.4px',
            color: '#0A0A0A',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: 11, color: '#909090', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right: page actions + global chrome (search, notifications, avatar) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}
        <span className="cos-desktop-only">
          <IconButton aria-label="Suche (⌘K)" onClick={() => window.dispatchEvent(new Event('cos:open-search'))}>
            <Search size={15} />
          </IconButton>
        </span>
        <NotificationsBell />
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: '#0A0A0A', color: '#fff',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          letterSpacing: '.03em',
          cursor: 'pointer',
        }}>
          {initials}
        </div>
      </div>
    </header>
  );
}

function IconButton({ children, 'aria-label': ariaLabel, onClick }: { children: React.ReactNode; 'aria-label': string; onClick?: () => void }) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 32, height: 32,
        borderRadius: 9,
        border: '1px solid #E4E3DF',
        background: 'transparent',
        color: '#505050',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background .24s cubic-bezier(.16,1,.3,1), color .24s cubic-bezier(.16,1,.3,1), transform .24s cubic-bezier(.16,1,.3,1)',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = '#0A0A0A';
        el.style.color = '#fff';
        el.style.transform = 'scale(1.08)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = 'transparent';
        el.style.color = '#505050';
        el.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}
