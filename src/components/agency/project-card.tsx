'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Paperclip, ArrowUpRight, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { usePrivacy } from '@/components/privacy/privacy-mode';

const ease = 'cubic-bezier(.16,1,.3,1) .24s';

type Status = 'open' | 'active' | 'feedback' | 'done' | 'archived';
type ChipVariant = 'filled' | 'outline' | 'gray';

const STATUS_META: Record<Status, { label: string; variant: ChipVariant }> = {
  open: { label: 'Offen', variant: 'gray' },
  active: { label: 'In Bearbeitung', variant: 'filled' },
  feedback: { label: 'Feedback', variant: 'outline' },
  done: { label: 'Abgeschlossen', variant: 'gray' },
  archived: { label: 'Archiviert', variant: 'gray' },
};

export interface ProjectCardProps {
  href: string;
  name: string;
  description: string | null;
  percent: number;
  status: Status;
  messageCount?: number;
  fileCount?: number;
  clientNames?: string[];
  clientIds?: string[];
  endDate?: Date | number | null;
}

export function ProjectCard({ href, name, description, percent, status, messageCount, fileCount, clientNames, clientIds, endDate }: ProjectCardProps) {
  const { allowed, hideStyle } = usePrivacy();
  // Whitelist: Projekte von im Blur-Modus erstellten/beteiligten Kunden bleiben lesbar.
  const clientBlur = hideStyle(clientIds?.find((id) => allowed.has(id)));
  const [hovered, setHovered] = useState(false);
  const meta = STATUS_META[status];
  const isDone = status === 'done';

  const textColor = hovered ? '#fff' : '#0A0A0A';
  const subColor = hovered ? 'rgba(255,255,255,.55)' : '#505050';
  const metaColor = hovered ? 'rgba(255,255,255,.4)' : '#909090';
  const barTrack = hovered ? 'rgba(255,255,255,.15)' : '#E4E3DF';
  const barFill = hovered ? '#fff' : '#0A0A0A';

  const chipStyles: Record<ChipVariant, React.CSSProperties> = {
    filled: { background: hovered ? 'rgba(255,255,255,.18)' : '#0A0A0A', color: hovered ? 'rgba(255,255,255,.8)' : '#fff' },
    outline: { border: `1px solid ${hovered ? 'rgba(255,255,255,.35)' : '#0A0A0A'}`, color: hovered ? 'rgba(255,255,255,.8)' : '#0A0A0A', background: 'transparent' },
    gray: { background: hovered ? 'rgba(255,255,255,.12)' : '#EDECE9', color: hovered ? 'rgba(255,255,255,.6)' : '#505050' },
  };

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0A0A0A' : '#fff',
        border: '1px solid #E4E3DF',
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transform: hovered ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? '0 20px 56px rgba(0,0,0,.18)' : 'none',
        transition: `background ${ease}, transform ${ease}, box-shadow ${ease}`,
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-2px', color: textColor, lineHeight: 1, transition: `color ${ease}` }}>
          {percent}%
        </span>
        <span style={{ borderRadius: 100, padding: '3px 10px', fontSize: 11, fontWeight: 600, transition: `background ${ease}, color ${ease}, border-color ${ease}`, ...chipStyles[meta.variant] }}>
          {meta.label}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: textColor, transition: `color ${ease}` }}>{name}</span>
        <span style={{ fontSize: 12, color: subColor, lineHeight: 1.55, transition: `color ${ease}`, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {description || 'Keine Beschreibung'}
        </span>
      </div>

      <div style={{ height: 2, background: barTrack, borderRadius: 100, transition: `background ${ease}` }}>
        <div style={{ height: '100%', width: `${percent}%`, background: barFill, borderRadius: 100, transition: `width ${ease}, background ${ease}` }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        {isDone && endDate ? (
          <span style={{ fontSize: 11, color: metaColor, transition: `color ${ease}` }}>Abgeschlossen · {formatDate(endDate)}</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageCircle size={12} color={metaColor} />
              <span style={{ fontSize: 11, color: metaColor, transition: `color ${ease}` }}>{messageCount ?? 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Paperclip size={12} color={metaColor} />
              <span style={{ fontSize: 11, color: metaColor, transition: `color ${ease}` }}>{fileCount ?? 0}</span>
            </div>
            {clientNames && clientNames.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={12} color={metaColor} />
                <span style={{ fontSize: 11, color: metaColor, transition: `color ${ease}`, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...clientBlur }}>{clientNames[0]}{clientNames.length > 1 ? ` +${clientNames.length - 1}` : ''}</span>
              </div>
            )}
          </div>
        )}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: hovered ? 'rgba(255,255,255,.18)' : '#0A0A0A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `background ${ease}` }}>
          <ArrowUpRight size={15} />
        </div>
      </div>
    </Link>
  );
}
