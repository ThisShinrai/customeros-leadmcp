import { asc, eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { projectResources, type ProjectResource } from '@/lib/db';

/** Resources for a project (caller must already have verified project access). */
export async function getProjectResources(projectId: string): Promise<ProjectResource[]> {
  const db = await getRequestDb();
  return db.select().from(projectResources).where(eq(projectResources.projectId, projectId)).orderBy(asc(projectResources.sortOrder));
}
