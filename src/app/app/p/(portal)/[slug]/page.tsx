import Link from 'next/link';
import { FolderKanban, Receipt, MessageCircle, CalendarClock, ArrowRight, ArrowUpRight } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { EmptyState, BentoCard } from '@/components/ui';
import { ProjectCard } from '@/components/agency/project-card';
import { PortalHeader } from '@/components/portal/portal-header';
import { PortalStatCard } from '@/components/portal/portal-stat-card';
import { formatEUR, formatDate } from '@/lib/utils';
import { getClientOverview } from './queries';

export default async function PortalOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requirePortalSession();
  const overview = await getClientOverview(session.agencyId, session.client.id);

  const firstName = session.client.name.split(' ')[0] || session.client.name;

  return (
    <div className="page-transition">
      <PortalHeader
        title={`Willkommen zurück, ${firstName}`}
        subtitle={session.agency.name}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* TOP: hero + stats */}
        <div className="portal-top" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, alignItems: 'stretch' }}>
          {/* Hero */}
          <BentoCard dark padding={0} style={{ position: 'relative', overflow: 'hidden', minHeight: 296, display: 'flex' }}>
            <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),.5), transparent 65%)', top: -100, right: -80, filter: 'blur(40px)', opacity: .6, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: 'rgba(255,255,255,.4)', lineHeight: 1 }}>Ihr Portal</span>
                <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', lineHeight: 1.04, color: '#fff', margin: '16px 0 0' }}>
                  Willkommen<br />zurück, {firstName}.
                </h1>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', margin: '10px 0 0' }}>{session.agency.name}</p>
              </div>
              <Link
                href={`/app/p/${slug}/projekte`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '13px 20px', fontSize: 14, fontWeight: 700, marginTop: 24, transition: 'transform .14s var(--ease)' }}
              >
                Projekte ansehen <ArrowUpRight size={16} />
              </Link>
            </div>
          </BentoCard>

          {/* Stats */}
          <div className="portal-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <PortalStatCard
              label="Aktive Projekte"
              value={overview.activeProjects}
              sub={overview.activeProjects === 1 ? 'Projekt in Arbeit' : 'Projekte in Arbeit'}
              icon={<FolderKanban size={17} />}
            />
            <PortalStatCard
              label="Offene Rechnungen"
              value={overview.openInvoices}
              sub={overview.openInvoiceCents > 0 ? `${formatEUR(overview.openInvoiceCents)} ausstehend` : 'Alles bezahlt'}
              icon={<Receipt size={17} />}
              accent={overview.openInvoices > 0}
            />
            <PortalStatCard
              label="Neue Nachrichten"
              value={overview.unreadMessages}
              sub={overview.unreadMessages > 0 ? 'Ungelesen im Chat' : 'Keine neuen Nachrichten'}
              icon={<MessageCircle size={17} />}
            />
          </div>
        </div>

        {/* Next deadline */}
        {overview.nextDeadline && (
          <BentoCard
            padding={0}
            style={{ position: 'relative', overflow: 'hidden', background: 'var(--accent)', border: 'none' }}
          >
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 88% 50%, rgba(255,255,255,.18), transparent 60%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarClock size={21} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '.13em', marginBottom: 5 }}>
                  Nächster Termin
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {overview.nextDeadline.taskTitle}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
                  {overview.nextDeadline.projectName} · {formatDate(overview.nextDeadline.due)}
                </div>
              </div>
            </div>
          </BentoCard>
        )}

        {/* Projects */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090', lineHeight: 1 }}>Ihre Projekte</span>
            {overview.projects.length > 0 && (
              <Link
                href={`/app/p/${slug}/projekte`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: '#505050' }}
              >
                Alle ansehen <ArrowRight size={13} />
              </Link>
            )}
          </div>

          {overview.projects.length === 0 ? (
            <BentoCard interactive={false} padding={0}>
              <EmptyState
                icon={<FolderKanban size={24} />}
                title="Noch keine Projekte"
                description="Sobald Ihre Agentur ein Projekt für Sie freigibt, erscheint es hier."
              />
            </BentoCard>
          ) : (
            <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
              {overview.projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  href={`/app/p/${slug}/projekte/${p.id}`}
                  name={p.name}
                  description={p.description}
                  percent={p.percent}
                  status={p.status}
                  messageCount={p.messageCount}
                  fileCount={p.fileCount}
                  endDate={p.endDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1000px) {
          .portal-top { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .portal-stats { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .portal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
