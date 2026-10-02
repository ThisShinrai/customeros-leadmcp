import { requireAgencySession } from '@/lib/auth/session';
import { ensureTaskColumns, getAllTasks } from './queries';
import { TasksView } from './tasks-view';

export default async function TasksPage() {
  const session = await requireAgencySession();
  const taskColumns = await ensureTaskColumns(session.agencyId); // seed defaults + backfill first
  const data = await getAllTasks(session.agencyId);
  const canEdit = session.permissions.has('projects:edit');

  return <TasksView data={data} taskColumns={taskColumns} canEdit={canEdit} />;
}
