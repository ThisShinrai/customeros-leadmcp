import { eq, inArray, desc } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { clientUsers, projectClients, projects } from '@/lib/db';

export type ClientStatus = 'aktiv' | 'eingeladen' | 'deaktiviert';

export interface ClientListItem {
  id: string;
  name: string;
  email: string;
  company: string | null;
  // E-Rechnung (EN 16931): buyer postal address + VAT ID.
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  vatId: string | null;
  status: ClientStatus;
  portalEnabled: boolean;
  projectCount: number;
  lastLoginAt: Date | null;
  avatarUrl: string | null;
  avatarFrameColor: string | null;
}

export function deriveStatus(portalEnabled: boolean, lastLoginAt: Date | null): ClientStatus {
  if (portalEnabled) return 'aktiv';
  return lastLoginAt ? 'deaktiviert' : 'eingeladen';
}

export async function listClients(agencyId: string): Promise<ClientListItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(clientUsers).where(eq(clientUsers.agencyId, agencyId)).orderBy(desc(clientUsers.createdAt));
  const ids = rows.map((r) => r.id);

  // project counts (only active, non-archived projects)
  const links = ids.length
    ? await db.select({ clientId: projectClients.clientId, status: projects.status })
        .from(projectClients)
        .innerJoin(projects, eq(projectClients.projectId, projects.id))
        .where(inArray(projectClients.clientId, ids))
    : [];
  const counts = new Map<string, number>();
  for (const l of links) {
    if (l.status === 'archived') continue;
    counts.set(l.clientId, (counts.get(l.clientId) ?? 0) + 1);
  }

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    company: c.company,
    street: c.street,
    zip: c.zip,
    city: c.city,
    country: c.country,
    vatId: c.vatId,
    status: deriveStatus(c.portalEnabled, c.lastLoginAt),
    portalEnabled: c.portalEnabled,
    projectCount: counts.get(c.id) ?? 0,
    lastLoginAt: c.lastLoginAt,
    avatarUrl: c.avatarUrl,
    avatarFrameColor: c.avatarFrameColor,
  }));
}
