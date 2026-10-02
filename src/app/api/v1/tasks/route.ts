import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { tasks, projects } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api-keys';

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getRequestDb();
  const data = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, projectId: tasks.projectId })
    .from(tasks).innerJoin(projects, eq(tasks.projectId, projects.id)).where(eq(projects.agencyId, auth.agencyId));
  return Response.json({ data });
}
