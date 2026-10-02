import { FolderKanban } from 'lucide-react';
import { requirePortalSession } from '@/lib/auth/session';
import { EmptyState, BentoCard } from '@/components/ui';
import { ProjectCard } from '@/components/agency/project-card';
import { PortalHeader } from '@/components/portal/portal-header';
import { getClientProjects } from '../queries';

export default async function PortalProjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requirePortalSession();
  const projects = await getClientProjects(session.agencyId, session.client.id);

  return (
    <div className="page-transition">
      <PortalHeader
        title="Projekte"
        subtitle={`${projects.length} Projekt${projects.length === 1 ? '' : 'e'}`}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 36px' }}>
        {projects.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<FolderKanban size={24} />}
              title="Noch keine Projekte freigegeben"
              description="Ihre Agentur hat Ihnen noch keine Projekte zugeordnet. Sobald ein Projekt freigegeben wird, sehen Sie es hier."
            />
          </BentoCard>
        ) : (
          <div className="portal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
            {projects.map((p) => (
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

      <style>{`
        @media (max-width: 560px) {
          .portal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
