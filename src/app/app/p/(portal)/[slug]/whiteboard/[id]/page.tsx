import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { requirePortalSession } from '@/lib/auth/session';
import { getRequestDb, projects } from '@/lib/db';
import { getClientWhiteboard } from '@/lib/whiteboards/queries';
import type { WhiteboardScene } from '@/components/whiteboard/whiteboard-editor';
import { PortalWhiteboard } from './portal-whiteboard';

export default async function PortalWhiteboardPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const session = await requirePortalSession();
  if (session.agency.slug !== slug) notFound();

  const board = await getClientWhiteboard(session.agencyId, id, session.client.id);
  if (!board) notFound();

  const db = await getRequestDb();
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, board.projectId), eq(projects.agencyId, session.agencyId)),
  });

  let initialScene: WhiteboardScene | null = null;
  if (board.scene) {
    try { initialScene = JSON.parse(board.scene) as WhiteboardScene; } catch { initialScene = null; }
  }

  return (
    <PortalWhiteboard
      slug={slug}
      boardId={board.id}
      boardName={board.name}
      projectId={board.projectId}
      projectName={project?.name ?? 'Projekt'}
      initialScene={initialScene}
      initialVersion={board.version}
    />
  );
}
