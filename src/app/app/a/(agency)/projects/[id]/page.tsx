import { notFound } from 'next/navigation';
import { requireAgencySession } from '@/lib/auth/session';
import { getProjectResources } from '@/lib/project-resources';
import { getProjectDetail, listAssignable } from '../queries';
import { listProjectFolders } from './folder-actions';
import { ProjectDetailView } from './project-detail-view';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAgencySession();
  const [detail, assignable, resources, folders] = await Promise.all([
    getProjectDetail(session.agencyId, id),
    listAssignable(session.agencyId),
    getProjectResources(id),
    listProjectFolders(id),
  ]);
  if (!detail) notFound();

  return (
    <ProjectDetailView
      detail={detail}
      assignableMembers={assignable.members}
      assignableClients={assignable.clients}
      resources={resources}
      folders={folders}
      canEdit={session.permissions.has('projects:edit')}
      filePerms={{
        upload: session.permissions.has('files:upload'),
        release: session.permissions.has('files:release'),
        delete: session.permissions.has('files:delete'),
      }}
    />
  );
}
