import Link from 'next/link';
import { Receipt, CheckCircle2, ChevronRight } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { EmptyState, BentoCard } from '@/components/ui';
import { PortalHeader } from '@/components/portal/portal-header';
import { formatEUR, formatDate } from '@/lib/utils';
import { getClientInvoices } from '../queries';

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Entwurf', bg: '#F4F3F0', color: '#909090' },
  sent: { label: 'Offen', bg: '#FFFBEB', color: '#D97706' },
  paid: { label: 'Bezahlt', bg: '#F0FDF4', color: '#16A34A' },
  overdue: { label: 'Überfällig', bg: '#FEF2F2', color: '#DC2626' },
};

function Label({ children, color = '#909090' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color, lineHeight: 1 }}>{children}</span>;
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span style={{ background: meta.bg, color: meta.color, borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '4px 11px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {meta.label}
    </span>
  );
}

export default async function PortalInvoicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requirePortalSession();
  const invoices = await getClientInvoices(session.agencyId, session.client.id);

  const open = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const openTotal = open.reduce((s, i) => s + i.totalAmount, 0);
  const hasOpen = open.length > 0;

  return (
    <div className="page-transition">
      <PortalHeader
        title="Rechnungen"
        subtitle={`${invoices.length} Rechnung${invoices.length === 1 ? '' : 'en'}`}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', color: '#0A0A0A', margin: 0, lineHeight: 1.02 }}>Rechnungen</h1>

        {invoices.length > 0 && (
          <div className="inv-summary" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, alignItems: 'stretch' }}>
            {/* Open total — massive accent number on dark hero */}
            <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden', minHeight: 168, display: 'flex' }}>
              <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${hasOpen ? 'rgba(var(--accent-rgb),.5)' : 'rgba(22,163,74,.4)'}, transparent 65%)`, top: -120, right: -80, filter: 'blur(42px)', opacity: .6, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1, padding: '24px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Label color="rgba(255,255,255,.4)">{hasOpen ? 'Offener Betrag' : 'Alle Rechnungen beglichen'}</Label>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: hasOpen ? 'rgba(var(--accent-rgb),.18)' : 'rgba(22,163,74,.2)', color: hasOpen ? 'var(--accent)' : '#4ADE80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {hasOpen ? <Receipt size={18} /> : <CheckCircle2 size={18} />}
                  </span>
                </div>
                <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: hasOpen ? 'var(--accent)' : '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {formatEUR(openTotal)}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>
                  {hasOpen ? `${open.length} ${open.length === 1 ? 'offene Rechnung' : 'offene Rechnungen'}` : 'Nichts ausstehend'}
                </div>
              </div>
            </BentoCard>

            {/* Count tiles */}
            <div className="inv-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <BentoCard padding={22} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 168 }}>
                <Label>Offen</Label>
                <div>
                  <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: hasOpen ? '#0A0A0A' : '#909090', fontVariantNumeric: 'tabular-nums' }}>{open.length}</div>
                  <div style={{ fontSize: 12, color: '#909090', marginTop: 5 }}>{open.length === 1 ? 'Rechnung offen' : 'Rechnungen offen'}</div>
                </div>
              </BentoCard>
              <BentoCard padding={22} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 168 }}>
                <Label>Gesamt</Label>
                <div>
                  <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: '#0A0A0A', fontVariantNumeric: 'tabular-nums' }}>{invoices.length}</div>
                  <div style={{ fontSize: 12, color: '#909090', marginTop: 5 }}>{invoices.length === 1 ? 'Rechnung insgesamt' : 'Rechnungen insgesamt'}</div>
                </div>
              </BentoCard>
            </div>
          </div>
        )}

        {invoices.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<Receipt size={24} />}
              title="Noch keine Rechnungen freigegeben"
              description="Sobald Ihre Agentur eine Rechnung für Sie freigibt, erscheint sie hier."
            />
          </BentoCard>
        ) : (
          <div>
            <div style={{ marginBottom: 12, padding: '0 4px' }}><Label>Alle Rechnungen</Label></div>
            <BentoCard interactive={false} padding={0} style={{ overflow: 'hidden' }}>
              {invoices.map((inv, idx) => (
                <Link
                  key={inv.id}
                  href={`/app/p/${slug}/rechnungen/${inv.id}`}
                  className="portal-inv-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px 14px',
                    padding: '16px 20px',
                    borderBottom: idx < invoices.length - 1 ? '1px solid #F0EFEC' : 'none',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{inv.title}</div>
                    <div style={{ fontSize: 12, color: '#909090', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inv.projectName || 'Rechnung'}{inv.dueDate ? ` · fällig ${formatDate(inv.dueDate)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 'auto' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0A0A0A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatEUR(inv.totalAmount)}</span>
                    <StatusChip status={inv.status} />
                    <ChevronRight size={16} style={{ color: '#C4C4C0', flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </BentoCard>
          </div>
        )}
      </div>

      <style>{`
        .portal-inv-row { transition: background .12s var(--ease); }
        .portal-inv-row:hover { background: #FAFAF9; }
        @media (min-width: 760px) {
          .inv-summary { grid-template-columns: 1.4fr 1.6fr !important; }
        }
        @media (max-width: 440px) {
          .inv-stats { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
