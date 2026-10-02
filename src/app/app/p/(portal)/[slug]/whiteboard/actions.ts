'use server';

import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { whiteboards } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';
import { getClientWhiteboard } from '@/lib/whiteboards/queries';

/** Persist a client's edits to a shared whiteboard (last-write-wins). */
export async function savePortalWhiteboardScene(id: string, sceneJson: string, baseVersion: number): Promise<{ version: number }> {
  const session = await requirePortalSession();
  const board = await getClientWhiteboard(session.agencyId, id, session.client.id);
  if (!board) throw new Error('FORBIDDEN');
  if (sceneJson.length > 4_000_000) throw new Error('SCENE_TOO_LARGE');

  const db = await getRequestDb();
  const nextVersion = Math.max(board.version, baseVersion) + 1;
  await db
    .update(whiteboards)
    .set({ scene: sceneJson, version: nextVersion, updatedBy: session.client.id, updatedByName: session.client.name, updatedAt: new Date() })
    .where(eq(whiteboards.id, id));
  return { version: nextVersion };
}

/** Poll for remote changes on a shared whiteboard. */
export async function syncPortalWhiteboard(id: string, sinceVersion: number): Promise<{ version: number; sceneJson: string | null; updatedByName: string | null }> {
  const session = await requirePortalSession();
  const board = await getClientWhiteboard(session.agencyId, id, session.client.id);
  if (!board) throw new Error('FORBIDDEN');
  if (board.version > sinceVersion) {
    return { version: board.version, sceneJson: board.scene, updatedByName: board.updatedByName };
  }
  return { version: board.version, sceneJson: null, updatedByName: board.updatedByName };
}
