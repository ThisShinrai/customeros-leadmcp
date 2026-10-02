import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { projects } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api-keys';

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getRequestDb();
  const data = await db.select({ id: projects.id, name: projects.name, status: projects.status, createdAt: projects.createdAt })
    .from(projects).where(eq(projects.agencyId, auth.agencyId));
  return Response.json({ data });
}
