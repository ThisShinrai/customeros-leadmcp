import { desc, eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { leads, leadNotes, type Lead, type LeadNote } from '@/lib/db';

export interface LeadListItem extends Lead {
  notes: LeadNote[];
}

/** Alle Leads der Agentur inkl. Notizen (Filter/Suche laufen client-seitig). */
export async function listAgencyLeads(agencyId: string): Promise<LeadListItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(leads).where(eq(leads.agencyId, agencyId)).orderBy(desc(leads.updatedAt)).limit(1000);
  if (rows.length === 0) return [];
  const allNotes = await db.select().from(leadNotes).orderBy(desc(leadNotes.createdAt)).limit(3000);
  const byLead = new Map<string, LeadNote[]>();
  const leadIds = new Set(rows.map((l) => l.id));
  for (const n of allNotes) {
    if (!leadIds.has(n.leadId)) continue;
    (byLead.get(n.leadId) ?? byLead.set(n.leadId, []).get(n.leadId)!).push(n);
  }
  return rows.map((l) => ({ ...l, notes: byLead.get(l.id) ?? [] }));
}
