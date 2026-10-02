'use client';

import { BentoCard } from '@/components/ui';

interface PortalStatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}

export function PortalStatCard({ label, value, sub, icon, accent }: PortalStatCardProps) {
  const numColor = accent ? 'var(--accent)' : '#0A0A0A';
  const iconBg = accent ? 'rgba(var(--accent-rgb),.12)' : '#F4F3F0';
  const iconColor = accent ? 'var(--accent)' : '#505050';

  return (
    <BentoCard
      padding={22}
      style={{
        flex: 1,
        minWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 138,
        background: accent ? 'rgba(var(--accent-rgb),.045)' : '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090', lineHeight: 1 }}>
          {label}
        </span>
        {icon && (
          <span style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, color: numColor, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 12, color: '#909090', marginTop: 6 }}>{sub}</div>}
      </div>
    </BentoCard>
  );
}
