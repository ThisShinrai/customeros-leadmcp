'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { files, projects, projectClients } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';
import { buildProjectFileKey, putObject } from '@/lib/storage/r2';
import { assertStorageAvailable } from '@/lib/storage/quota';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/** Client-side upload: only allowed for projects the client is assigned to. */
export async function uploadClientFile(formData: FormData) {
  const session = await requirePortalSession();
  const db = await getRequestDb();

  const projectId = String(formData.get('projectId') || '');
  const file = formData.get('file');
  if (!projectId) throw new Error('NO_PROJECT');
  if (!(file instanceof File) || file.size === 0) throw new Error('NO_FILE');
  if (file.size > MAX_SIZE) throw new Error('TOO_LARGE');

  // Tenant + ownership: client must be assigned to the project…
  const assigned = await db.query.projectClients.findFirst({
    where: and(eq(projectClients.projectId, projectId), eq(projectClients.clientId, session.client.id)),
  });
  if (!assigned) throw new Error('FORBIDDEN');

  // …and the project must belong to the client's agency.
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.agencyId, session.agencyId)),
  });
  if (!project) throw new Error('FORBIDDEN');

  // Plan storage quota (aggregate across the agency).
  await assertStorageAvailable(db, session.agencyId, session.agency.plan, file.size);

  const key = buildProjectFileKey(session.agencyId, projectId, file.name);
  await putObject(key, await file.arrayBuffer(), file.type || 'application/octet-stream');

  await db.insert(files).values({
    projectId,
    agencyId: session.agencyId,
    name: file.name,
    size: file.size,
    r2Key: key,
    mimeType: file.type || 'application/octet-stream',
    uploadedBy: session.client.id,
    uploaderType: 'client_user',
    visibleToClient: false,
  });

  revalidatePath(`/app/p/${session.agency.slug}/dateien`);
  return { ok: true };
}
