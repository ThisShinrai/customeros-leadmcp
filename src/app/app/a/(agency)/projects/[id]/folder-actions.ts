'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { folders, files, projects } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';

const NameSchema = z.string().trim().min(1, 'Name fehlt').max(120);

async function assertProject(db: Awaited<ReturnType<typeof getRequestDb>>, projectId: string, agencyId: string) {
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!p) throw new Error('NOT_FOUND');
}

export async function createFolder(projectId: string, name: string, parentId?: string | null): Promise<{ ok: true; id: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'files:upload');
  const db = await getRequestDb();
  await assertProject(db, projectId, s.agencyId);
  const clean = NameSchema.parse(name);
  // If a parent is given it must belong to the same project.
  if (parentId) {
    const parent = await db.query.folders.findFirst({ where: and(eq(folders.id, parentId), eq(folders.projectId, projectId)) });
    if (!parent) throw new Error('NOT_FOUND');
  }
  const [row] = await db.insert(folders).values({
    agencyId: s.agencyId, projectId, name: clean, parentId: parentId || null, createdBy: s.user.id,
  }).returning();
  revalidatePath(`/app/a/projects/${projectId}`);
  return { ok: true, id: row.id };
}

export async function renameFolder(id: string, name: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'files:upload');
  const db = await getRequestDb();
  const folder = await db.query.folders.findFirst({ where: and(eq(folders.id, id), eq(folders.agencyId, s.agencyId)) });
  if (!folder) throw new Error('NOT_FOUND');
  await db.update(folders).set({ name: NameSchema.parse(name) }).where(eq(folders.id, id));
  revalidatePath(`/app/a/projects/${folder.projectId}`);
  return { ok: true };
}

export async function setFolderVisible(id: string, visible: boolean): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'files:release');
  const db = await getRequestDb();
  const folder = await db.query.folders.findFirst({ where: and(eq(folders.id, id), eq(folders.agencyId, s.agencyId)) });
  if (!folder) throw new Error('NOT_FOUND');
  await db.update(folders).set({ visibleToClient: visible }).where(eq(folders.id, id));
  revalidatePath(`/app/a/projects/${folder.projectId}`);
  return { ok: true };
}

/** Delete a folder; its files + subfolders are re-parented one level up. */
export async function deleteFolder(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'files:delete');
  const db = await getRequestDb();
  const folder = await db.query.folders.findFirst({ where: and(eq(folders.id, id), eq(folders.agencyId, s.agencyId)) });
  if (!folder) throw new Error('NOT_FOUND');
  await db.update(files).set({ folderId: folder.parentId }).where(eq(files.folderId, id));
  await db.update(folders).set({ parentId: folder.parentId }).where(eq(folders.parentId, id));
  await db.delete(folders).where(eq(folders.id, id));
  revalidatePath(`/app/a/projects/${folder.projectId}`);
  return { ok: true };
}

export async function moveFileToFolder(fileId: string, folderId: string | null): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'files:upload');
  const db = await getRequestDb();
  const file = await db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.agencyId, s.agencyId)) });
  if (!file) throw new Error('NOT_FOUND');
  if (folderId) {
    const target = await db.query.folders.findFirst({ where: and(eq(folders.id, folderId), eq(folders.projectId, file.projectId)) });
    if (!target) throw new Error('NOT_FOUND');
  }
  await db.update(files).set({ folderId }).where(eq(files.id, fileId));
  revalidatePath(`/app/a/projects/${file.projectId}`);
  return { ok: true };
}

export async function listProjectFolders(projectId: string): Promise<{ id: string; name: string; parentId: string | null; visibleToClient: boolean }[]> {
  const s = await requireAgencySession();
  const db = await getRequestDb();
  const rows = await db.select().from(folders).where(and(eq(folders.projectId, projectId), eq(folders.agencyId, s.agencyId)));
  return rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId, visibleToClient: r.visibleToClient }));
}
