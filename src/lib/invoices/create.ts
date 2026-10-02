import { and, eq, like } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { invoices, invoiceItems, clientUsers, agencies } from '@/lib/db';
import { notifyClient } from '@/lib/email/notify';
import { dispatchWebhook } from '@/lib/webhooks';
import { buildInvoiceKey, putObject, deleteObject } from '@/lib/storage/r2';
import { buildInvoicePdf, computeInvoiceTotals, type InvoicePdfItem } from '@/lib/pdf/invoice-pdf';

/** Sequential invoice number RG-YYYY-NNNN, per agency per year. */
export async function nextInvoiceNumber(db: Db, agencyId: string, year: number): Promise<string> {
  const prefix = `RG-${year}-`;
  const rows = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices)
    .where(and(eq(invoices.agencyId, agencyId), like(invoices.invoiceNumber, `${prefix}%`)));
  let max = 0;
  for (const r of rows) {
    const n = parseInt((r.invoiceNumber ?? '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${(max + 1).toString().padStart(4, '0')}`;
}

/** Build + persist the branded PDF for an invoice from its line items. */
export async function generateInvoicePdf(db: Db, invoiceId: string, agencyId: string): Promise<string | null> {
  const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.agencyId, agencyId)) });
  if (!invoice) return null;
  const [items, client, agency] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).orderBy(invoiceItems.sortOrder),
    db.query.clientUsers.findFirst({ where: eq(clientUsers.id, invoice.clientId) }),
    db.query.agencies.findFirst({ where: eq(agencies.id, agencyId) }),
  ]);
  if (items.length === 0 || !agency) return null;

  const bytes = await buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber ?? '—',
    title: invoice.title,
    issueDate: invoice.createdAt ?? new Date(),
    dueDate: invoice.dueDate,
    agency: {
      name: agency.name, address: agency.address, street: agency.street, zip: agency.zip, city: agency.city, country: agency.country,
      contactEmail: agency.contactEmail, phone: agency.phone, website: agency.website, taxId: agency.taxId, iban: agency.iban, bic: agency.bic,
    },
    client: { name: client?.name ?? '—', company: client?.company, email: client?.email },
    items: items.map((it) => ({ description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate })),
    notes: invoice.notes,
    accentHex: agency.accentColor,
  });

  if (invoice.pdfR2Key) { try { await deleteObject(invoice.pdfR2Key); } catch { /* ignore */ } }
  const key = buildInvoiceKey(agencyId, invoiceId, `${invoice.invoiceNumber ?? 'rechnung'}.pdf`);
  await putObject(key, bytes, 'application/pdf');
  await db.update(invoices).set({ pdfR2Key: key, pdfGenerated: true, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  return key;
}

export interface CreateInvoiceInput {
  agencyId: string;
  clientId: string;
  projectId: string;
  title: string;
  notes?: string | null;
  dueDate?: Date | null;
  items: InvoicePdfItem[];
}

/**
 * Session-less invoice creation shared by server actions, recurring billing
 * and time-tracking. Inserts the invoice + line items and renders the PDF.
 */
export async function createInvoiceWithItems(db: Db, input: CreateInvoiceInput): Promise<{ id: string; invoiceNumber: string; totalAmount: number }> {
  const items = input.items.filter((it) => it.description.trim() && it.quantity > 0);
  if (items.length === 0) throw new Error('NO_ITEMS');
  const total = computeInvoiceTotals(items).grossCents;
  const year = (input.dueDate ?? new Date()).getFullYear();
  const number = await nextInvoiceNumber(db, input.agencyId, year);

  const [invoice] = await db.insert(invoices).values({
    agencyId: input.agencyId,
    projectId: input.projectId,
    clientId: input.clientId,
    title: input.title,
    invoiceNumber: number,
    notes: input.notes ?? null,
    status: 'draft',
    totalAmount: total,
    dueDate: input.dueDate ?? null,
    visibleToClient: false,
  }).returning();

  await db.insert(invoiceItems).values(items.map((it, i) => ({
    invoiceId: invoice.id, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate, sortOrder: i,
  })));

  try { await generateInvoicePdf(db, invoice.id, input.agencyId); } catch { /* PDF best-effort */ }
  return { id: invoice.id, invoiceNumber: number, totalAmount: total };
}

/** Session-less release: make visible, flip draft→sent, notify client + webhook. */
export async function releaseInvoiceRecord(db: Db, invoiceId: string, agencyId: string): Promise<void> {
  const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.agencyId, agencyId)) });
  if (!invoice) return;
  await db.update(invoices).set({
    visibleToClient: true,
    ...(invoice.status === 'draft' ? { status: 'sent' as const } : {}),
    updatedAt: new Date(),
  }).where(eq(invoices.id, invoiceId));

  const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, agencyId) });
  await notifyClient(db, {
    clientId: invoice.clientId, agencyId,
    heading: 'Neue Rechnung verfügbar',
    body: `Eine neue Rechnung${invoice.invoiceNumber ? ` (${invoice.invoiceNumber})` : ''} steht in Ihrem Portal bereit.`,
    path: `/app/p/${agency?.slug ?? ''}/rechnungen/${invoiceId}`,
    ctaLabel: 'Rechnung ansehen',
  });
  await dispatchWebhook(db, agencyId, 'invoice.sent', { id: invoiceId, number: invoice.invoiceNumber, clientId: invoice.clientId });
}
