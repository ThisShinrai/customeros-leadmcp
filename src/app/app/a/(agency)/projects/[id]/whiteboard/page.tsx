import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { requireAgencySession } from '@/lib/auth/session';
import { getRequestDb, projects } from '@/lib/db';
import { listProjectWhiteboards } from '@/lib/whiteboards/queries';
import { WhiteboardWorkspace } from './workspace';

export default async function ProjectWhiteboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAgencySession();

  const db = await getRequestDb();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.agencyId, session.agencyId)),
  });
  if (!project) notFound();

  const boards = await listProjectWhiteboards(session.agencyId, id);

  return (
    <WhiteboardWorkspace
      projectId={id}
      projectName={project.name}
      initialBoards={boards}
      canEdit={session.permissions.has('projects:edit')}
    />
  );
}
