import Link from 'next/link';
import { FileSignature, ChevronRight } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { EmptyState, BentoCard } from '@/components/ui';
import { PortalHeader } from '@/components/portal/portal-header';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';
import { getClientProposals, type ClientProposalListItem } from '../proposal-actions';

const STATUS_META: Record<ClientProposalListItem['status'], { label: string; bg: string; color: string }> = {
  draft: { label: 'Entwurf', bg: '#F4F3F0', color: '#909090' },
  sent: { label: 'Gesendet', bg: '#FFFBEB', color: '#D97706' },
  viewed: { label: 'Angesehen', bg: '#EFF6FF', color: '#2563EB' },
  signed: { label: 'Unterschrieben', bg: '#F0FDF4', color: '#16A34A' },
  declined: { label: 'Abgelehnt', bg: '#FEF2F2', color: '#DC2626' },
};

function Label({ children, color = '#909090' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color, lineHeight: 1 }}>{children}</span>;
}

function StatusChip({ status }: { status: ClientProposalListItem['status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.sent;
  return (
    <span style={{ background: meta.bg, color: meta.color, borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '4px 11px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {meta.label}
    </span>
  );
}

export default async function PortalProposalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requirePortalSession();
  const proposals = await getClientProposals();

  const open = proposals.filter((p) => p.status === 'sent' || p.status === 'viewed');

  return (
    <div className="page-transition">
      <PortalHeader
        title="Angebote"
        subtitle={`${proposals.length} Angebot${proposals.length === 1 ? '' : 'e'}`}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', color: '#0A0A0A', margin: 0, lineHeight: 1.02 }}>Angebote</h1>

        {open.length > 0 && (
          <BentoCard interactive={false} padding={0} style={{ position: 'relative', overflow: 'hidden', background: '#111111', borderRadius: 20 }}>
            <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -120, right: -70, filter: 'blur(42px)', opacity: .6, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(var(--accent-rgb),.18)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileSignature size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>
                  {open.length === 1 ? '1 Angebot wartet auf Sie' : `${open.length} Angebote warten auf Sie`}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', marginTop: 3 }}>Bitte prüfen und annehmen oder ablehnen.</div>
              </div>
            </div>
          </BentoCard>
        )}

        {proposals.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<FileSignature size={24} />}
              title="Noch keine Angebote"
              description="Sobald Ihre Agentur Ihnen ein Angebot sendet, erscheint es hier zur Prüfung und Unterschrift."
            />
          </BentoCard>
        ) : (
          <div>
            <div style={{ marginBottom: 12, padding: '0 4px' }}><Label>Alle Angebote</Label></div>
            <BentoCard interactive={false} padding={0} style={{ overflow: 'hidden' }}>
              {proposals.map((p, idx) => (
                <Link
                  key={p.id}
                  href={`/app/p/${slug}/angebote/${p.id}`}
                  className="portal-prop-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px 14px',
                    padding: '16px 20px',
                    borderBottom: idx < proposals.length - 1 ? '1px solid #F0EFEC' : 'none',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.number || 'Angebot'}{p.validUntil ? ` · gültig bis ${fmtDate(p.validUntil)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 'auto' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0A0A0A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(p.totalAmount)}</span>
                    <StatusChip status={p.status} />
                    <ChevronRight size={16} style={{ color: '#C4C4C0', flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </BentoCard>
          </div>
        )}
      </div>

      <style>{`
        .portal-prop-row { transition: background .12s var(--ease); }
        .portal-prop-row:hover { background: #FAFAF9; }
      `}</style>
    </div>
  );
}
