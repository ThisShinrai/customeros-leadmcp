'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { files, folders, projects, projectClients } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';
import { notifyClient } from '@/lib/email/notify';
import { buildProjectFileKey, putObject, deleteObject } from '@/lib/storage/r2';
import { assertStorageAvailable } from '@/lib/storage/quota';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function uploadProjectFile(formData: FormData) {
  const session = await requireAgencySession();
  assertCan(session, 'files:upload');
  const db = await getRequestDb();

  const projectId = String(formData.get('projectId') || '');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('NO_FILE');
  if (file.size > MAX_SIZE) throw new Error('TOO_LARGE');

  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, session.agencyId)) });
  if (!project) throw new Error('NOT_FOUND');

  // Plan storage quota (aggregate across the agency).
  await assertStorageAvailable(db, session.agencyId, session.agency.plan, file.size);

  // Optional target folder (must belong to this project).
  const rawFolderId = String(formData.get('folderId') || '');
  let folderId: string | null = null;
  if (rawFolderId) {
    const f = await db.query.folders.findFirst({ where: and(eq(folders.id, rawFolderId), eq(folders.projectId, projectId), eq(folders.agencyId, session.agencyId)) });
    folderId = f ? f.id : null;
  }

  // Optionaler Anzeigename (z. B. „Logo-Entwurf v2" statt „file_000097707…").
  // Dateiendung des Originals bleibt erhalten, damit Vorschau/Downloads passen.
  const rawName = String(formData.get('displayName') || '').trim().slice(0, 160);
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(file.name)?.[0] ?? '';
  const displayName = rawName
    ? (ext && !rawName.toLowerCase().endsWith(ext.toLowerCase()) ? `${rawName}${ext}` : rawName)
    : file.name;

  const key = buildProjectFileKey(session.agencyId, projectId, displayName);
  await putObject(key, await file.arrayBuffer(), file.type || 'application/octet-stream');

  const [row] = await db.insert(files).values({
    projectId,
    agencyId: session.agencyId,
    name: displayName,
    size: file.size,
    r2Key: key,
    mimeType: file.type || 'application/octet-stream',
    uploadedBy: session.user.id,
    uploaderType: 'agency_user',
    visibleToClient: false,
    folderId,
  }).returning();

  revalidatePath(`/app/a/projects/${projectId}`);
  return {
    id: row.id, name: row.name, size: row.size, mimeType: row.mimeType,
    uploaderType: row.uploaderType, uploaderName: session.user.name,
    visibleToClient: row.visibleToClient, createdAt: row.createdAt ? new Date(row.createdAt).getTime() : null,
  };
}

export async function setFileVisibility(fileId: string, visible: boolean) {
  const session = await requireAgencySession();
  assertCan(session, 'files:release');
  const db = await getRequestDb();
  const file = await db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.agencyId, session.agencyId)) });
  if (!file) throw new Error('NOT_FOUND');
  await db.update(files).set({ visibleToClient: visible }).where(eq(files.id, fileId));

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: visible ? 'file.released' : 'file.unreleased',
    targetType: 'file',
    targetId: fileId,
    meta: { name: file.name, projectId: file.projectId },
  });

  if (visible) {
    const pcs = await db.select({ clientId: projectClients.clientId }).from(projectClients).where(eq(projectClients.projectId, file.projectId));
    for (const pc of pcs) {
      await notifyClient(db, {
        clientId: pc.clientId, agencyId: session.agencyId,
        heading: 'Neue Datei freigegeben',
        body: `„${file.name}" wurde für Sie freigegeben.`,
        path: `/app/p/${session.agency.slug}/dateien`,
        ctaLabel: 'Dateien öffnen',
      });
    }
  }

  revalidatePath(`/app/a/projects/${file.projectId}`);
  return { ok: true };
}

/** Anzeigename einer Datei ändern (R2-Key bleibt; die Endung bleibt erhalten). */
export async function renameProjectFile(fileId: string, newName: string) {
  const session = await requireAgencySession();
  assertCan(session, 'files:upload');
  const db = await getRequestDb();
  const file = await db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.agencyId, session.agencyId)) });
  if (!file) throw new Error('NOT_FOUND');

  const raw = newName.trim().slice(0, 160);
  if (!raw) throw new Error('NO_NAME');
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(file.name)?.[0] ?? '';
  const name = ext && !raw.toLowerCase().endsWith(ext.toLowerCase()) ? `${raw}${ext}` : raw;

  await db.update(files).set({ name }).where(eq(files.id, fileId));
  revalidatePath(`/app/a/projects/${file.projectId}`);
  return { ok: true, name };
}

export async function deleteProjectFile(fileId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'files:delete');
  const db = await getRequestDb();
  const file = await db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.agencyId, session.agencyId)) });
  if (!file) throw new Error('NOT_FOUND');
  try { await deleteObject(file.r2Key); } catch { /* ignore */ }
  await db.delete(files).where(eq(files.id, fileId));
  revalidatePath(`/app/a/projects/${file.projectId}`);
  return { ok: true };
}
