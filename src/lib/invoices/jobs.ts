import { and, eq, lt, lte } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { invoices, recurringInvoices, type RecurringInvoice } from '@/lib/db';
import { createInvoiceWithItems, releaseInvoiceRecord } from './create';
import type { InvoicePdfItem } from '@/lib/pdf/invoice-pdf';

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** Flip released, past-due, unpaid invoices to 'overdue'. Returns the count. */
export async function markOverdueInvoices(db: Db): Promise<number> {
  const now = new Date();
  const rows = await db.select({ id: invoices.id }).from(invoices)
    .where(and(eq(invoices.status, 'sent'), lt(invoices.dueDate, now)));
  if (rows.length === 0) return 0;
  await db.update(invoices).set({ status: 'overdue', updatedAt: now })
    .where(and(eq(invoices.status, 'sent'), lt(invoices.dueDate, now)));
  return rows.length;
}

/** Materialise one invoice from a recurring template and advance its schedule. */
export async function generateFromRecurring(db: Db, rec: RecurringInvoice): Promise<string | null> {
  let items: InvoicePdfItem[] = [];
  try { items = JSON.parse(rec.items) as InvoicePdfItem[]; } catch { items = []; }
  if (!Array.isArray(items) || items.length === 0) return null;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const { id } = await createInvoiceWithItems(db, {
    agencyId: rec.agencyId, clientId: rec.clientId, projectId: rec.projectId,
    title: rec.title, notes: rec.notes, dueDate, items,
  });
  if (rec.autoRelease) await releaseInvoiceRecord(db, id, rec.agencyId);

  await db.update(recurringInvoices).set({
    nextRunAt: addMonths(rec.nextRunAt, rec.intervalMonths || 1),
    lastGeneratedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(recurringInvoices.id, rec.id));
  return id;
}

/** Generate invoices for every active recurring template that's due. */
export async function generateDueRecurring(db: Db): Promise<number> {
  const now = new Date();
  const due = await db.select().from(recurringInvoices)
    .where(and(eq(recurringInvoices.active, true), lte(recurringInvoices.nextRunAt, now)));
  let count = 0;
  for (const rec of due) {
    try { if (await generateFromRecurring(db, rec)) count += 1; } catch { /* skip one bad template */ }
  }
  return count;
}
