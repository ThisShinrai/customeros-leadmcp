import { and, desc, eq, ne } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { timeEntries, projects } from '@/lib/db';

export interface TimeEntryItem {
  id: string;
  projectId: string;
  projectName: string;
  userName: string | null;
  description: string;
  minutes: number;
  occurredAt: Date;
  billable: boolean;
  rateCents: number | null;
  billed: boolean;
}

export interface TimeData {
  entries: TimeEntryItem[];
  projects: { id: string; name: string }[];
  totalMinutes: number;
  unbilledBillableMinutes: number;
}

export async function getTimeData(agencyId: string): Promise<TimeData> {
  const db = await getRequestDb();
  const [rows, projs] = await Promise.all([
    db.select().from(timeEntries).where(eq(timeEntries.agencyId, agencyId)).orderBy(desc(timeEntries.occurredAt)).limit(500),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.agencyId, agencyId), ne(projects.status, 'archived'))),
  ]);
  const pName = new Map(projs.map((p) => [p.id, p.name]));

  let totalMinutes = 0, unbilledBillableMinutes = 0;
  const entries: TimeEntryItem[] = rows.map((r) => {
    totalMinutes += r.minutes;
    if (r.billable && !r.invoiceId) unbilledBillableMinutes += r.minutes;
    return {
      id: r.id, projectId: r.projectId, projectName: pName.get(r.projectId) ?? '—',
      userName: r.userName, description: r.description, minutes: r.minutes, occurredAt: r.occurredAt,
      billable: r.billable, rateCents: r.rateCents, billed: !!r.invoiceId,
    };
  });

  return { entries, projects: projs, totalMinutes, unbilledBillableMinutes };
}
