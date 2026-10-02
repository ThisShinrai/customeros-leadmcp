'use server';

import { z } from 'zod';
import { and, eq, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { invoices, invoiceItems, projects, clientUsers, agencies } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';
import { assertPlanFeature } from '@/lib/plans';
import { notifyClient } from '@/lib/email/notify';
import { dispatchWebhook } from '@/lib/webhooks';
import { buildInvoiceKey, putObject, deleteObject } from '@/lib/storage/r2';
import { buildInvoicePdf, computeInvoiceTotals, type InvoicePdfItem } from '@/lib/pdf/invoice-pdf';

async function assertInvoice(db: Db, id: string, agencyId: string) {
  const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, id), eq(invoices.agencyId, agencyId)) });
  if (!invoice) throw new Error('NOT_FOUND');
  return invoice;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a money string into integer cents. Handles German ("2.400,00"),
 * plain ("2400"), and dot-decimal ("2400.00") notations robustly.
 */
function parseAmountToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let s = trimmed.replace(/[^\d.,-]/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const value = Number(s);
  if (!isFinite(value)) return null;
  return Math.round(value * 100);
}

// ── Invoice number: RG-YYYY-NNNN, sequential per agency per year ──────
async function nextInvoiceNumber(db: Db, agencyId: string, year: number): Promise<string> {
  const prefix = `RG-${year}-`;
  const rows = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(and(eq(invoices.agencyId, agencyId), like(invoices.invoiceNumber, `${prefix}%`)));
  let max = 0;
  for (const r of rows) {
    const n = parseInt((r.invoiceNumber ?? '').slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${(max + 1).toString().padStart(4, '0')}`;
}

/**
 * Build the branded PDF for an invoice from its stored line items and
 * persist it to R2. Returns the R2 key, or null if there are no items.
 */
async function generatePdfForInvoice(db: Db, invoiceId: string, agencyId: string): Promise<string | null> {
  const invoice = await assertInvoice(db, invoiceId, agencyId);
  const [items, client, agency] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).orderBy(invoiceItems.sortOrder),
    db.query.clientUsers.findFirst({ where: eq(clientUsers.id, invoice.clientId) }),
    db.query.agencies.findFirst({ where: eq(agencies.id, agencyId) }),
  ]);
  if (items.length === 0 || !agency) return null;

  const pdfItems: InvoicePdfItem[] = items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unitPriceCents: it.unitPriceCents,
    taxRate: it.taxRate,
  }));

  const bytes = await buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber ?? '—',
    title: invoice.title,
    issueDate: invoice.createdAt ?? new Date(),
    dueDate: invoice.dueDate,
    agency: {
      name: agency.name,
      address: agency.address,
      street: agency.street,
      zip: agency.zip,
      city: agency.city,
      country: agency.country,
      contactEmail: agency.contactEmail,
      phone: agency.phone,
      website: agency.website,
      taxId: agency.taxId,
      iban: agency.iban,
      bic: agency.bic,
    },
    client: { name: client?.name ?? '—', company: client?.company, email: client?.email },
    items: pdfItems,
    notes: invoice.notes,
    accentHex: agency.accentColor,
  });

  // Replace any previously generated PDF.
  if (invoice.pdfR2Key) {
    try { await deleteObject(invoice.pdfR2Key); } catch { /* ignore */ }
  }
  const key = buildInvoiceKey(agencyId, invoiceId, `${invoice.invoiceNumber ?? 'rechnung'}.pdf`);
  await putObject(key, bytes, 'application/pdf');
  await db.update(invoices).set({ pdfR2Key: key, pdfGenerated: true, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  return key;
}

const ItemSchema = z.object({
  description: z.string().trim().min(1, 'Beschreibung erforderlich').max(200),
  quantity: z.number().int().positive().max(100000),
  unitPriceCents: z.number().int().min(0),
  taxRate: z.number().int().min(0).max(100),
});

const CreateInvoiceSchema = z.object({
  title: z.string().trim().min(1, 'Titel erforderlich').max(160),
  clientId: z.string().min(1, 'Kunde erforderlich'),
  projectId: z.string().min(1, 'Projekt erforderlich'),
  dueDate: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createInvoice(formData: FormData) {
  const session = await requireAgencySession();
  assertCan(session, 'invoices:create');
  assertPlanFeature(session.agency.plan, 'invoices');

  const data = CreateInvoiceSchema.parse({
    title: String(formData.get('title') ?? ''),
    clientId: String(formData.get('clientId') ?? ''),
    projectId: String(formData.get('projectId') ?? ''),
    dueDate: (formData.get('dueDate') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  });

  // Parse line items (JSON). unitPrice arrives as a euro string per row.
  const rawItems = String(formData.get('items') ?? '[]');
  let items: InvoicePdfItem[] = [];
  try {
    const parsed = JSON.parse(rawItems) as { description: string; quantity: number; unitPriceEuro: string; taxRate: number }[];
    items = parsed.map((r) =>
      ItemSchema.parse({
        description: r.description,
        quantity: Number(r.quantity),
        unitPriceCents: parseAmountToCents(String(r.unitPriceEuro ?? '')) ?? 0,
        taxRate: Number(r.taxRate),
      }),
    );
  } catch {
    items = [];
  }

  // Fallback simple amount (when no line items are provided).
  const fallbackCents = parseAmountToCents(String(formData.get('amountEuro') ?? '')) ?? 0;
  const computedTotal = items.length > 0 ? computeInvoiceTotals(items).grossCents : fallbackCents;
  if (computedTotal <= 0) throw new Error('Betrag muss größer als 0 sein');

  const db = await getRequestDb();

  // Tenant isolation: both client and project must belong to this agency.
  const client = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.id, data.clientId), eq(clientUsers.agencyId, session.agencyId)) });
  if (!client) throw new Error('NOT_FOUND');
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, data.projectId), eq(projects.agencyId, session.agencyId)) });
  if (!project) throw new Error('NOT_FOUND');

  const number = await nextInvoiceNumber(db, session.agencyId, (parseDate(data.dueDate) ?? new Date()).getFullYear());

  const [invoice] = await db.insert(invoices).values({
    agencyId: session.agencyId,
    projectId: data.projectId,
    clientId: data.clientId,
    title: data.title,
    invoiceNumber: number,
    notes: data.notes ?? null,
    status: 'draft',
    totalAmount: computedTotal,
    dueDate: parseDate(data.dueDate),
    visibleToClient: false,
  }).returning();

  // Persist line items.
  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map((it, i) => ({
        invoiceId: invoice.id,
        description: it.description,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        taxRate: it.taxRate,
        sortOrder: i,
      })),
    );
  }

  // Either generate a branded PDF from line items, or accept an uploaded PDF.
  const file = formData.get('pdf');
  if (file instanceof File && file.size > 0) {
    const key = buildInvoiceKey(session.agencyId, invoice.id, file.name);
    await putObject(key, await file.arrayBuffer(), file.type || 'application/pdf');
    await db.update(invoices).set({ pdfR2Key: key, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
  } else if (items.length > 0) {
    await generatePdfForInvoice(db, invoice.id, session.agencyId);
  }

  revalidatePath('/app/a/invoices');
  return { ok: true };
}

/** Edit an existing invoice: update fields, replace line items, regenerate PDF.
 *  Keeps the invoice number, status and client-visibility untouched. */
export async function updateInvoice(id: string, formData: FormData) {
  const session = await requireAgencySession();
  assertCan(session, 'invoices:create');
  const db = await getRequestDb();
  await assertInvoice(db, id, session.agencyId);

  const data = CreateInvoiceSchema.parse({
    title: String(formData.get('title') ?? ''),
    clientId: String(formData.get('clientId') ?? ''),
    projectId: String(formData.get('projectId') ?? ''),
    dueDate: (formData.get('dueDate') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
  });

  const rawItems = String(formData.get('items') ?? '[]');
  let items: InvoicePdfItem[] = [];
  try {
    const parsed = JSON.parse(rawItems) as { description: string; quantity: number; unitPriceEuro: string; taxRate: number }[];
    items = parsed.map((r) =>
      ItemSchema.parse({
        description: r.description,
        quantity: Number(r.quantity),
        unitPriceCents: parseAmountToCents(String(r.unitPriceEuro ?? '')) ?? 0,
        taxRate: Number(r.taxRate),
      }),
    );
  } catch {
    items = [];
  }

  const fallbackCents = parseAmountToCents(String(formData.get('amountEuro') ?? '')) ?? 0;
  const computedTotal = items.length > 0 ? computeInvoiceTotals(items).grossCents : fallbackCents;
  if (computedTotal <= 0) throw new Error('Betrag muss größer als 0 sein');

  // Tenant isolation for the (possibly changed) client + project.
  const client = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.id, data.clientId), eq(clientUsers.agencyId, session.agencyId)) });
  if (!client) throw new Error('NOT_FOUND');
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, data.projectId), eq(projects.agencyId, session.agencyId)) });
  if (!project) throw new Error('NOT_FOUND');

  await db.update(invoices).set({
    title: data.title,
    clientId: data.clientId,
    projectId: data.projectId,
    notes: data.notes ?? null,
    totalAmount: computedTotal,
    dueDate: parseDate(data.dueDate),
    updatedAt: new Date(),
  }).where(eq(invoices.id, id));

  // Replace line items, then rebuild the branded PDF from them.
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map((it, i) => ({ invoiceId: id, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate, sortOrder: i })),
    );
    await generatePdfForInvoice(db, id, session.agencyId);
  }

  revalidatePath('/app/a/invoices');
  return { ok: true };
}

/** Regenerate the branded PDF from the invoice's current line items. */
export async function regenerateInvoicePdf(id: string) {
  const session = await requireAgencySession();
  assertCan(session, 'invoices:create');
  const db = await getRequestDb();
  const key = await generatePdfForInvoice(db, id, session.agencyId);
  if (!key) throw new Error('NO_ITEMS');
  revalidatePath('/app/a/invoices');
  return { ok: true };
}

export async function releaseInvoice(id: string) {
  const session = await requireAgencySession();
  assertCan(session, 'invoices:release');
  const db = await getRequestDb();
  const invoice = await assertInvoice(db, id, session.agencyId);

  await db.update(invoices).set({
    visibleToClient: true,
    ...(invoice.status === 'draft' ? { status: 'sent' as const } : {}),
    updatedAt: new Date(),
  }).where(eq(invoices.id, id));

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: 'invoice.sent',
    targetType: 'invoice',
    targetId: id,
    meta: { invoiceNumber: invoice.invoiceNumber },
  });

  await notifyClient(db, {
    clientId: invoice.clientId, agencyId: session.agencyId,
    heading: 'Neue Rechnung verfügbar',
    body: `Eine neue Rechnung${invoice.invoiceNumber ? ` (${invoice.invoiceNumber})` : ''} steht in Ihrem Portal bereit.`,
    path: `/app/p/${session.agency.slug}/rechnungen/${id}`,
    ctaLabel: 'Rechnung ansehen',
  });
  await dispatchWebhook(db, session.agencyId, 'invoice.sent', { id, number: invoice.invoiceNumber, clientId: invoice.clientId });

  revalidatePath('/app/a/invoices');
  return { ok: true };
}

export async function setInvoiceStatus(id: string, status: 'draft' | 'sent' | 'paid' | 'overdue') {
  const session = await requireAgencySession();
  assertCan(session, 'invoices:release');
  const db = await getRequestDb();
  const invoice = await assertInvoice(db, id, session.agencyId);

  await db.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, id));

  if (status === 'paid' && invoice.status !== 'paid') {
    await logAudit(db, {
      agencyId: session.agencyId,
      actorId: session.user.id,
      actorName: session.user.name,
      action: 'invoice.paid',
      targetType: 'invoice',
      targetId: id,
      meta: { invoiceNumber: invoice.invoiceNumber },
    });
    await dispatchWebhook(db, session.agencyId, 'invoice.paid', { id, number: invoice.invoiceNumber, clientId: invoice.clientId });
  }

  revalidatePath('/app/a/invoices');
  return { ok: true };
}

export async function deleteInvoice(id: string) {
  const session = await requireAgencySession();
  assertCan(session, 'invoices:delete');
  const db = await getRequestDb();
  const invoice = await assertInvoice(db, id, session.agencyId);

  if (invoice.pdfR2Key) {
    try { await deleteObject(invoice.pdfR2Key); } catch { /* ignore */ }
  }
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db.delete(invoices).where(eq(invoices.id, id));

  revalidatePath('/app/a/invoices');
  return { ok: true };
}
