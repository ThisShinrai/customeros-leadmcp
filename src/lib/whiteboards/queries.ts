import { and, eq, desc } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { whiteboards, projects, projectClients, type Whiteboard } from '@/lib/db';

export interface WhiteboardListItem {
  id: string;
  name: string;
  sharedWithClient: boolean;
  version: number;
  updatedByName: string | null;
  updatedAt: Date | null;
  hasContent: boolean;
}

function toListItem(w: Whiteboard): WhiteboardListItem {
  return {
    id: w.id,
    name: w.name,
    sharedWithClient: w.sharedWithClient,
    version: w.version,
    updatedByName: w.updatedByName,
    updatedAt: w.updatedAt,
    hasContent: !!w.scene && w.scene.length > 2,
  };
}

/** All whiteboards of a project (agency-side, tenant-isolated). */
export async function listProjectWhiteboards(agencyId: string, projectId: string): Promise<WhiteboardListItem[]> {
  const db = await getRequestDb();
  const rows = await db
    .select()
    .from(whiteboards)
    .where(and(eq(whiteboards.agencyId, agencyId), eq(whiteboards.projectId, projectId)))
    .orderBy(desc(whiteboards.updatedAt));
  return rows.map(toListItem);
}

/** Only the whiteboards a client is allowed to see (shared + on a project they're assigned to). */
export async function listSharedWhiteboards(agencyId: string, projectId: string, clientId: string): Promise<WhiteboardListItem[]> {
  const db = await getRequestDb();
  // Verify the client is assigned to this project.
  const assigned = await db.query.projectClients.findFirst({
    where: and(eq(projectClients.projectId, projectId), eq(projectClients.clientId, clientId)),
  });
  if (!assigned) return [];
  const rows = await db
    .select()
    .from(whiteboards)
    .where(and(eq(whiteboards.agencyId, agencyId), eq(whiteboards.projectId, projectId), eq(whiteboards.sharedWithClient, true)))
    .orderBy(desc(whiteboards.updatedAt));
  return rows.map(toListItem);
}

/** Agency-side single board lookup (tenant-isolated). */
export async function getAgencyWhiteboard(agencyId: string, id: string): Promise<Whiteboard | null> {
  const db = await getRequestDb();
  const w = await db.query.whiteboards.findFirst({ where: and(eq(whiteboards.id, id), eq(whiteboards.agencyId, agencyId)) });
  return w ?? null;
}

/**
 * Portal-side single board lookup: must belong to the agency, be shared, and
 * sit on a project the client is assigned to.
 */
export async function getClientWhiteboard(agencyId: string, id: string, clientId: string): Promise<Whiteboard | null> {
  const db = await getRequestDb();
  const w = await db.query.whiteboards.findFirst({ where: and(eq(whiteboards.id, id), eq(whiteboards.agencyId, agencyId)) });
  if (!w || !w.sharedWithClient) return null;
  const assigned = await db.query.projectClients.findFirst({
    where: and(eq(projectClients.projectId, w.projectId), eq(projectClients.clientId, clientId)),
  });
  if (!assigned) return null;
  return w;
}

/** Parse a stored scene JSON into the editor's initial scene shape. */
export function parseScene(scene: string | null): { elements: unknown[]; files: Record<string, unknown> } | null {
  if (!scene) return null;
  try {
    const parsed = JSON.parse(scene) as { elements?: unknown[]; files?: Record<string, unknown> };
    return { elements: parsed.elements ?? [], files: parsed.files ?? {} };
  } catch {
    return null;
  }
}

export async function assertProjectInAgency(agencyId: string, projectId: string): Promise<boolean> {
  const db = await getRequestDb();
  const p = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  return !!p;
}
