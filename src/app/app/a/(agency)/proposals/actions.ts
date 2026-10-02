'use server';

import { z } from 'zod';
import { and, asc, eq, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { proposals, proposalItems, clientUsers, projects, projectClients, invoices, invoiceItems } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { sendInviteMagicLink } from '@/lib/auth/invite';
import { computeTotals } from '@/lib/invoices/format';
import { generateInvoicePdf } from '@/lib/invoices/create';
import { logAudit } from '@/lib/audit';

const ItemSchema = z.object({
  description: z.string().trim().min(1, 'Beschreibung erforderlich').max(200),
  quantity: z.number().int().positive().max(100000),
  unitPriceCents: z.number().int().min(0),
  taxRate: z.number().int().min(0).max(100),
});

const SaveSchema = z.object({
  title: z.string().trim().min(1, 'Titel erforderlich').max(160),
  clientId: z.string().min(1, 'Kunde erforderlich'),
  projectId: z.string().min(1, 'Projekt erforderlich'),
  intro: z.string().max(4000).optional(),
  validUntil: z.string().max(40).optional(),
  items: z.array(ItemSchema).min(1, 'Mindestens eine Position'),
});

async function nextNumber(db: Db, agencyId: string, prefix: string): Promise<string> {
  const p = `${prefix}-${new Date().getFullYear()}-`;
  const rows = await db.select({ number: proposals.number }).from(proposals)
    .where(and(eq(proposals.agencyId, agencyId), like(proposals.number, `${p}%`)));
  let max = 0;
  for (const r of rows) { const n = parseInt((r.number ?? '').slice(p.length), 10); if (!isNaN(n) && n > max) max = n; }
  return `${p}${String(max + 1).padStart(4, '0')}`;
}

async function ownedProposal(db: Db, id: string, agencyId: string) {
  const p = await db.query.proposals.findFirst({ where: and(eq(proposals.id, id), eq(proposals.agencyId, agencyId)) });
  if (!p) throw new Error('NOT_FOUND');
  return p;
}

export async function createProposal(input: unknown): Promise<{ id: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const data = SaveSchema.parse(input);
  const db = await getRequestDb();
  const client = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.id, data.clientId), eq(clientUsers.agencyId, s.agencyId)) });
  if (!client) throw new Error('NOT_FOUND');
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, data.projectId), eq(projects.agencyId, s.agencyId)) });
  if (!project) throw new Error('NOT_FOUND');
  const total = computeTotals(data.items).grossCents;
  const number = await nextNumber(db, s.agencyId, 'ANG');
  const [p] = await db.insert(proposals).values({
    agencyId: s.agencyId, projectId: data.projectId, clientId: data.clientId,
    number, title: data.title, intro: data.intro || null, status: 'draft', totalAmount: total,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
  }).returning();
  await db.insert(proposalItems).values(data.items.map((it, i) => ({ proposalId: p.id, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate, sortOrder: i })));
  revalidatePath('/app/a/proposals');
  return { id: p.id };
}

const WizardSchema = SaveSchema.omit({ projectId: true }).extend({
  /** Bestehendes Projekt — oder leer, dann wird eins mit newProjectName angelegt. */
  projectId: z.string().optional(),
  newProjectName: z.string().trim().max(160).optional(),
});

/** Angebots-Wizard: wie createProposal, legt aber bei Bedarf das Projekt gleich mit an. */
export async function createProposalFromWizard(input: unknown): Promise<{ id: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const data = WizardSchema.parse(input);
  const db = await getRequestDb();

  let projectId = data.projectId;
  if (!projectId) {
    const name = data.newProjectName?.trim() || data.title;
    const client = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.id, data.clientId), eq(clientUsers.agencyId, s.agencyId)) });
    if (!client) throw new Error('NOT_FOUND');
    const [project] = await db.insert(projects).values({ agencyId: s.agencyId, name, status: 'open' }).returning();
    await db.insert(projectClients).values({ projectId: project.id, clientId: client.id });
    projectId = project.id;
  }
  return createProposal({ ...data, projectId });
}

export async function updateProposal(id: string, input: unknown): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  const p = await ownedProposal(db, id, s.agencyId);
  if (p.status !== 'draft') throw new Error('Nur Entwürfe können bearbeitet werden.');
  const data = SaveSchema.parse(input);
  const total = computeTotals(data.items).grossCents;
  await db.update(proposals).set({
    title: data.title, intro: data.intro || null, clientId: data.clientId, projectId: data.projectId,
    validUntil: data.validUntil ? new Date(data.validUntil) : null, totalAmount: total, updatedAt: new Date(),
  }).where(eq(proposals.id, id));
  await db.delete(proposalItems).where(eq(proposalItems.proposalId, id));
  await db.insert(proposalItems).values(data.items.map((it, i) => ({ proposalId: id, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate, sortOrder: i })));
  revalidatePath('/app/a/proposals');
  return { ok: true };
}

export async function sendProposal(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  const p = await ownedProposal(db, id, s.agencyId);
  await db.update(proposals).set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() }).where(eq(proposals.id, id));
  const client = await db.query.clientUsers.findFirst({ where: eq(clientUsers.id, p.clientId) });
  if (client) { try { await sendInviteMagicLink(client.email, `/app/p/${s.agency.slug}/angebote`); } catch { /* email best-effort */ } }
  await logAudit(db, { agencyId: s.agencyId, actorId: s.user.id, actorName: s.user.name, action: 'proposal.sent', targetType: 'proposal', targetId: id });
  revalidatePath('/app/a/proposals');
  return { ok: true };
}

export async function deleteProposal(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  await ownedProposal(db, id, s.agencyId);
  await db.delete(proposalItems).where(eq(proposalItems.proposalId, id));
  await db.delete(proposals).where(eq(proposals.id, id));
  revalidatePath('/app/a/proposals');
  return { ok: true };
}

async function nextInvoiceNumber(db: Db, agencyId: string): Promise<string> {
  const pre = `RG-${new Date().getFullYear()}-`;
  const rows = await db.select({ number: invoices.invoiceNumber }).from(invoices)
    .where(and(eq(invoices.agencyId, agencyId), like(invoices.invoiceNumber, `${pre}%`)));
  let max = 0;
  for (const r of rows) { const n = parseInt((r.number ?? '').slice(pre.length), 10); if (!isNaN(n) && n > max) max = n; }
  return `${pre}${String(max + 1).padStart(4, '0')}`;
}

/** A signed proposal → a draft invoice (items copied, proposal linked). */
export async function convertToInvoice(id: string): Promise<{ id: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  const p = await ownedProposal(db, id, s.agencyId);
  if (p.status !== 'signed') throw new Error('Nur unterschriebene Angebote können umgewandelt werden.');
  if (p.convertedInvoiceId) return { id: p.convertedInvoiceId };
  const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, id)).orderBy(asc(proposalItems.sortOrder));
  const number = await nextInvoiceNumber(db, s.agencyId);
  // Zahlungsziel-Standard wie beim normalen Erstellen: 14 Tage ab heute.
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const [inv] = await db.insert(invoices).values({
    agencyId: s.agencyId, projectId: p.projectId!, clientId: p.clientId, title: p.title,
    invoiceNumber: number, status: 'draft', totalAmount: p.totalAmount, visibleToClient: false, dueDate,
  }).returning();
  if (items.length) {
    await db.insert(invoiceItems).values(items.map((it, i) => ({ invoiceId: inv.id, description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate, sortOrder: i })));
    try { await generateInvoicePdf(db, inv.id, s.agencyId); } catch { /* PDF best-effort — Rechnung existiert auch ohne */ }
  }
  await db.update(proposals).set({ convertedInvoiceId: inv.id, updatedAt: new Date() }).where(eq(proposals.id, id));
  revalidatePath('/app/a/proposals');
  revalidatePath('/app/a/invoices');
  return { id: inv.id };
}
