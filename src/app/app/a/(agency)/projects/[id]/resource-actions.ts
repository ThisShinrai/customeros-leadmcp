'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { projectResources, projects } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';

async function assertProject(db: Db, projectId: string, agencyId: string) {
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!p) throw new Error('NOT_FOUND');
  return p;
}

const CreateSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1, 'Titel erforderlich').max(120),
  url: z.string().trim().url('Ungültige URL').max(1000),
});

export async function createResource(input: unknown): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const data = CreateSchema.parse(input);
  const db = await getRequestDb();
  await assertProject(db, data.projectId, s.agencyId);
  const count = (await db.select({ id: projectResources.id }).from(projectResources).where(eq(projectResources.projectId, data.projectId))).length;
  await db.insert(projectResources).values({ agencyId: s.agencyId, projectId: data.projectId, title: data.title, url: data.url, sortOrder: count });
  revalidatePath(`/app/a/projects/${data.projectId}`);
  return { ok: true };
}

export async function deleteResource(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  const r = await db.query.projectResources.findFirst({ where: and(eq(projectResources.id, id), eq(projectResources.agencyId, s.agencyId)) });
  if (!r) throw new Error('NOT_FOUND');
  await db.delete(projectResources).where(eq(projectResources.id, id));
  revalidatePath(`/app/a/projects/${r.projectId}`);
  return { ok: true };
}
