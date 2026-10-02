import { and, eq, desc, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { invoices, invoiceItems, clientUsers, projects, agencies, type Invoice } from '@/lib/db';
import { computeTotals, type InvoiceDetail } from '@/lib/invoices/format';

export interface InvoiceListItem {
  id: string;
  title: string;
  invoiceNumber: string | null;
  status: Invoice['status'];
  totalAmount: number; // cents
  dueDate: Date | null;
  visibleToClient: boolean;
  pdfR2Key: string | null;
  pdfGenerated: boolean;
  reminderLevel: number;
  lastReminderAt: Date | null;
  clientId: string;
  clientName: string;
  projectName: string;
  createdAt: Date | null;
}

export async function listInvoices(agencyId: string): Promise<InvoiceListItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(invoices).where(eq(invoices.agencyId, agencyId)).orderBy(desc(invoices.createdAt));
  if (rows.length === 0) return [];

  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const projectIds = [...new Set(rows.map((r) => r.projectId))];

  const [clientRows, projectRows] = await Promise.all([
    db.select({ id: clientUsers.id, name: clientUsers.name }).from(clientUsers).where(inArray(clientUsers.id, clientIds)),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)),
  ]);

  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const projectName = new Map(projectRows.map((p) => [p.id, p.name]));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    invoiceNumber: r.invoiceNumber,
    status: r.status,
    totalAmount: r.totalAmount,
    dueDate: r.dueDate,
    visibleToClient: r.visibleToClient,
    pdfR2Key: r.pdfR2Key,
    pdfGenerated: r.pdfGenerated,
    reminderLevel: r.reminderLevel,
    lastReminderAt: r.lastReminderAt,
    clientId: r.clientId,
    clientName: clientName.get(r.clientId) ?? '—',
    projectName: projectName.get(r.projectId) ?? '—',
    createdAt: r.createdAt,
  }));
}

export interface InvoiceStats {
  openCents: number;
  overdueCents: number;
  paidCents: number;
}

export async function invoiceStats(agencyId: string): Promise<InvoiceStats> {
  const db = await getRequestDb();
  const rows = await db.select({ status: invoices.status, totalAmount: invoices.totalAmount }).from(invoices).where(eq(invoices.agencyId, agencyId));

  let openCents = 0;
  let overdueCents = 0;
  let paidCents = 0;
  for (const r of rows) {
    if (r.status === 'sent') openCents += r.totalAmount;
    else if (r.status === 'overdue') overdueCents += r.totalAmount;
    else if (r.status === 'paid') paidCents += r.totalAmount;
  }
  return { openCents, overdueCents, paidCents };
}

/** Full detail for one invoice (agency-scoped) → the on-screen document. */
export async function getInvoiceDetail(id: string, agencyId: string): Promise<InvoiceDetail | null> {
  const db = await getRequestDb();
  const inv = (await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.agencyId, agencyId))).limit(1))[0];
  if (!inv) return null;

  const [items, client, project, agency] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(invoiceItems.sortOrder),
    db.select().from(clientUsers).where(eq(clientUsers.id, inv.clientId)).limit(1).then((r) => r[0]),
    db.select().from(projects).where(eq(projects.id, inv.projectId)).limit(1).then((r) => r[0]),
    db.select().from(agencies).where(eq(agencies.id, agencyId)).limit(1).then((r) => r[0]),
  ]);

  const docItems = items.map((it) => ({ description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate }));
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    title: inv.title,
    status: inv.status,
    issueDate: inv.createdAt,
    dueDate: inv.dueDate,
    notes: inv.notes,
    totalAmount: inv.totalAmount,
    visibleToClient: inv.visibleToClient,
    // Positionen-Rechnungen sind immer renderbar (PDF-Route generiert on-demand).
    hasPdf: !!inv.pdfR2Key || docItems.length > 0,
    agency: {
      name: agency?.name ?? '—', logo: agency?.logo ?? null, accentColor: agency?.accentColor ?? null,
      address: agency?.address ?? null, contactEmail: agency?.contactEmail ?? null,
      phone: agency?.phone ?? null, website: agency?.website ?? null, taxId: agency?.taxId ?? null,
      iban: agency?.iban ?? null, bic: agency?.bic ?? null,
    },
    client: { name: client?.name ?? '—', company: client?.company ?? null, email: client?.email ?? null },
    clientId: inv.clientId,
    projectId: inv.projectId,
    projectName: project?.name ?? '—',
    items: docItems,
    totals: computeTotals(docItems),
  };
}

export interface InvoiceFormData {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}

export async function listInvoiceFormData(agencyId: string): Promise<InvoiceFormData> {
  const db = await getRequestDb();
  const [clients, projectRows] = await Promise.all([
    db.select({ id: clientUsers.id, name: clientUsers.name }).from(clientUsers).where(eq(clientUsers.agencyId, agencyId)),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.agencyId, agencyId)),
  ]);
  return { clients, projects: projectRows };
}
