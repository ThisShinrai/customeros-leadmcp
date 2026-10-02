import { desc, eq, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { recurringInvoices, clientUsers, projects } from '@/lib/db';
import { computeInvoiceTotals, type InvoicePdfItem } from '@/lib/pdf/invoice-pdf';

export interface RecurringListItem {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  intervalMonths: number;
  nextRunAt: Date;
  active: boolean;
  autoRelease: boolean;
  itemCount: number;
  totalCents: number;
  items: InvoicePdfItem[];
  notes: string | null;
  lastGeneratedAt: Date | null;
}

export async function listRecurring(agencyId: string): Promise<RecurringListItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(recurringInvoices)
    .where(eq(recurringInvoices.agencyId, agencyId))
    .orderBy(desc(recurringInvoices.active), recurringInvoices.nextRunAt);
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const [clients, projs] = await Promise.all([
    db.select({ id: clientUsers.id, name: clientUsers.name }).from(clientUsers).where(inArray(clientUsers.id, clientIds)),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)),
  ]);
  const cName = new Map(clients.map((c) => [c.id, c.name]));
  const pName = new Map(projs.map((p) => [p.id, p.name]));

  return rows.map((r) => {
    let items: InvoicePdfItem[] = [];
    try { items = JSON.parse(r.items) as InvoicePdfItem[]; } catch { items = []; }
    return {
      id: r.id, title: r.title,
      clientId: r.clientId, clientName: cName.get(r.clientId) ?? '—',
      projectId: r.projectId, projectName: pName.get(r.projectId) ?? '—',
      intervalMonths: r.intervalMonths, nextRunAt: r.nextRunAt,
      active: r.active, autoRelease: r.autoRelease,
      itemCount: items.length, totalCents: items.length ? computeInvoiceTotals(items).grossCents : 0,
      items, notes: r.notes, lastGeneratedAt: r.lastGeneratedAt,
    };
  });
}
