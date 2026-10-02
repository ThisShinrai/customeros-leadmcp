import { requireAgencySession } from '@/lib/auth/session';
import { listProjects, listAssignable } from './queries';
import { ProjectsView } from './projects-view';

export default async function ProjectsPage() {
  const session = await requireAgencySession();
  const [projects, assignable] = await Promise.all([
    listProjects(session.agencyId),
    listAssignable(session.agencyId),
  ]);

  return (
    <ProjectsView
      projects={projects}
      assignable={assignable}
      canCreate={session.permissions.has('projects:create')}
    />
  );
}
