'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { whiteboards } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { assertProjectInAgency } from '@/lib/whiteboards/queries';

async function assertBoard(db: Db, id: string, agencyId: string) {
  const board = await db.query.whiteboards.findFirst({ where: and(eq(whiteboards.id, id), eq(whiteboards.agencyId, agencyId)) });
  if (!board) throw new Error('NOT_FOUND');
  return board;
}

const NameSchema = z.string().trim().min(1, 'Name erforderlich').max(80);

export async function createWhiteboard(projectId: string, name: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const cleanName = NameSchema.parse(name || 'Neues Whiteboard');
  if (!(await assertProjectInAgency(session.agencyId, projectId))) throw new Error('NOT_FOUND');

  const db = await getRequestDb();
  const [board] = await db
    .insert(whiteboards)
    .values({
      agencyId: session.agencyId,
      projectId,
      name: cleanName,
      scene: null,
      sharedWithClient: false,
      version: 0,
      updatedBy: session.user.id,
      updatedByName: session.user.name,
    })
    .returning();

  revalidatePath(`/app/a/projects/${projectId}/whiteboard`);
  return { id: board.id };
}

export async function renameWhiteboard(id: string, name: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const cleanName = NameSchema.parse(name);
  const db = await getRequestDb();
  const board = await assertBoard(db, id, session.agencyId);
  await db.update(whiteboards).set({ name: cleanName, updatedAt: new Date() }).where(eq(whiteboards.id, id));
  revalidatePath(`/app/a/projects/${board.projectId}/whiteboard`);
  return { ok: true };
}

export async function setWhiteboardShared(id: string, shared: boolean) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const board = await assertBoard(db, id, session.agencyId);
  await db.update(whiteboards).set({ sharedWithClient: shared, updatedAt: new Date() }).where(eq(whiteboards.id, id));
  revalidatePath(`/app/a/projects/${board.projectId}/whiteboard`);
  return { ok: true };
}

export async function deleteWhiteboard(id: string) {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const board = await assertBoard(db, id, session.agencyId);
  await db.delete(whiteboards).where(eq(whiteboards.id, id));
  revalidatePath(`/app/a/projects/${board.projectId}/whiteboard`);
  return { ok: true };
}

/** Persist the scene. Last-write-wins with a monotonic version bump. */
export async function saveWhiteboardScene(id: string, sceneJson: string, baseVersion: number): Promise<{ version: number }> {
  const session = await requireAgencySession();
  assertCan(session, 'projects:edit');
  const db = await getRequestDb();
  const board = await assertBoard(db, id, session.agencyId);
  if (sceneJson.length > 4_000_000) throw new Error('SCENE_TOO_LARGE'); // ~4MB guard
  const nextVersion = Math.max(board.version, baseVersion) + 1;
  await db
    .update(whiteboards)
    .set({ scene: sceneJson, version: nextVersion, updatedBy: session.user.id, updatedByName: session.user.name, updatedAt: new Date() })
    .where(eq(whiteboards.id, id));
  return { version: nextVersion };
}

/** Poll for changes since a version. Returns the scene only when newer. */
export async function syncWhiteboard(id: string, sinceVersion: number): Promise<{ version: number; sceneJson: string | null; updatedByName: string | null }> {
  const session = await requireAgencySession();
  const db = await getRequestDb();
  const board = await assertBoard(db, id, session.agencyId);
  if (board.version > sinceVersion) {
    return { version: board.version, sceneJson: board.scene, updatedByName: board.updatedByName };
  }
  return { version: board.version, sceneJson: null, updatedByName: board.updatedByName };
}
