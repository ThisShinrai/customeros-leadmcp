'use client';

import { getInitials } from '@/lib/utils';
import { NavToggle } from '@/components/layout/nav-toggle';

interface PortalHeaderProps {
  title: string;
  subtitle?: string;
  clientName: string;
  avatarUrl?: string | null;
  avatarFrameColor?: string | null;
}

export function PortalHeader({ title, subtitle, clientName, avatarUrl, avatarFrameColor }: PortalHeaderProps) {
  return (
    <header
      className="cos-topbar"
      style={{
        background: 'rgba(255,255,255,.85)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: '1px solid #E4E3DF',
        height: 64,
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {/* Left: hamburger (mobile) + title + subtitle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <NavToggle />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px', color: '#0A0A0A', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#909090', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <div
        title={clientName}
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: avatarFrameColor || '#0A0A0A',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '.03em',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          getInitials(clientName)
        )}
      </div>
    </header>
  );
}
